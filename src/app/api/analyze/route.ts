import { NextRequest, NextResponse, after } from 'next/server';
import { fromError } from 'zod-validation-error';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { getAiConfiguration } from '@/lib/ai/ai-provider';
import { runAnalysisPipeline } from '@/lib/ai/pipeline';
import { createUsageRecorder } from '@/lib/ai/usage-repository';
import { requirePermission } from '@/lib/auth/require-permission';
import { carryOverReviews, checkStatusOverride } from '@/lib/dossier/state';
import { executeDossierJob } from '@/lib/jobs/job-worker';
import { logFailure } from '@/lib/observability/logger';
import { createSseStream } from '@/lib/sse/create-sse-stream';
import { isOwnUploadPath } from '@/lib/storage/storage-path';
import { DossierNotFoundError } from '@/lib/supabase/repository';
import {
  getAuditRepository,
  getDossierRepository,
  getJobRepository,
  getKnowledgeRepository,
  getLlmUsageRepository,
  getUniformCaseTitle,
  getWorkflowRepository,
} from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { DEFAULT_WORKFLOWS_BY_CASE_TYPE } from '@/lib/workflow/default-workflows';
import { AUDIT_ACTIONS } from '@/types/audit';
import { PERMISSION_ACTIONS, SessionContext } from '@/types/auth';
import {
  AnalyzeRequestSchema,
  UpdateDossierRequestSchema,
  UpdateDossierRequest,
  Dossier,
  STORAGE_TYPES,
} from '@/types/dossier';
import { JOB_RATE_LIMIT } from '@/types/jobs';
import { WORKFLOW_STEP_STATUS, WORKFLOW_STEP_TYPES } from '@/types/workflow';

export const maxDuration = 60; // Erlaube bis zu 60s Laufzeit für Dokumentenanalysen

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const rawBody: unknown = await req.json().catch(() => ({}));
    const parseResult = AnalyzeRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const validationError = fromError(parseResult.error);
      return NextResponse.json({ error: validationError.toString() }, { status: 400 });
    }

    const { files, caseType, notes, documentId, existingDossier } = parseResult.data;

    let aiConfig;
    try {
      aiConfig = getAiConfiguration();
    } catch (err: unknown) {
      logFailure('error', 'analyze_fehlgeschlagen', err);
      return NextResponse.json({ error: 'Kein KI-API-Key konfiguriert.' }, { status: 500 });
    }

    // Anmeldung ist Pflicht; die Kanzlei stammt aus der Mitgliedschaft der Sitzung
    const authSupabase = await createServerAuthClient();
    const { organizationId: resolvedOrgId } = await requirePermission(
      authSupabase,
      PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
      {
        requestedOrgId:
          parseResult.data.organizationId || req.headers.get('x-organization-id') || undefined,
        route: 'POST /api/analyze',
      }
    );

    // Speicherpfade sind Client-Eingaben: nur Upload-Pfade der eigenen Kanzlei
    if (files.some((f) => f.storagePath && !isOwnUploadPath(f.storagePath, resolvedOrgId))) {
      return NextResponse.json({ error: 'Ungültiger Speicherpfad.' }, { status: 400 });
    }

    // Prüfen, ob eine asynchrone Verarbeitung angefordert wurde (?async=true oder Header x-async: true)
    const isAsync =
      req.nextUrl.searchParams.get('async') === 'true' ||
      req.headers.get('x-async-mode') === 'true';

    // Kontingent gilt für beide Wege (Hintergrund-Job und Live-Stream)
    const jobRepo = getJobRepository(authSupabase);
    const windowStart = new Date(Date.now() - JOB_RATE_LIMIT.WINDOW_MS).toISOString();
    const recentJobs = await jobRepo.countJobsSince(resolvedOrgId, windowStart);
    if (recentJobs >= JOB_RATE_LIMIT.MAX_JOBS_PER_WINDOW) {
      return NextResponse.json(
        {
          error:
            'Das Kontingent an Analysen pro Stunde ist erreicht. Bitte später erneut versuchen.',
        },
        { status: 429, headers: { 'Retry-After': '3600' } }
      );
    }

    if (isAsync) {
      // Der Hintergrund-Pfad legt bewusst keine Workflow-Instanz an: der Worker hat kein
      // Workflow-Repository und kein Client liest den Ablaufstand eines Jobs.
      const dossierRepo = getDossierRepository(authSupabase);
      const job = await jobRepo.createJob(parseResult.data, resolvedOrgId);
      const workerDeps = {
        jobRepo,
        dossierRepo,
        knowledgeRepo: getKnowledgeRepository(authSupabase),
        auditRepo: getAuditRepository(authSupabase),
        usageRepo: getLlmUsageRepository(authSupabase),
      };

      // Starte Hintergrund-Worker entkoppelt und serverless-sicher via Next.js after()
      try {
        after(async () => {
          await executeDossierJob(job.id, workerDeps);
        });
      } catch (afterErr: unknown) {
        // Fallback falls after() im aktuellen Laufzeit-/Testkontext nicht aktiv ist
        logFailure('info', 'after_nicht_verfuegbar', afterErr);
        void executeDossierJob(job.id, workerDeps);
      }

      return NextResponse.json(
        {
          message: 'Job erfolgreich eingereiht.',
          jobId: job.id,
          status: job.status,
          pollUrl: `/api/jobs/${job.id}`,
        },
        { status: 202 }
      );
    }

    return createSseStream(async (emitter) => {
      const dossier = await runAnalysisPipeline({
        files,
        caseType,
        notes,
        existingDossier,
        organizationId: resolvedOrgId,
        knowledgeRepo: getKnowledgeRepository(authSupabase),
        onStageUsage: createUsageRecorder(getLlmUsageRepository(authSupabase), resolvedOrgId),
        model: aiConfig.model,
        extractionInstructions: aiConfig.extractionInstructions,
        auditorInstructions: aiConfig.auditorInstructions,
        onStep: (step, stepDetail) => {
          emitter.sendEvent({
            type: 'step',
            step,
            stepDetail,
          });
        },
      });

      const repo = getDossierRepository(authSupabase);
      let persistenceResult;
      if (documentId) {
        const updateRes = await repo.update(documentId, dossier, resolvedOrgId);
        const uniformTitle = getUniformCaseTitle(dossier.caseType, documentId);
        persistenceResult = {
          persisted: updateRes.success,
          storageType: STORAGE_TYPES.SUPABASE,
          caseNumber: uniformTitle,
          id: documentId,
        };
      } else {
        persistenceResult = await repo.save(dossier, resolvedOrgId);
      }

      // Workflow-Definition und Instanz in PostgreSQL synchronisieren
      const activeWorkflow = DEFAULT_WORKFLOWS_BY_CASE_TYPE[caseType];
      let workflowInstance = null;
      let workflowError: string | undefined;
      if (persistenceResult.id) {
        try {
          const workflowRepo = getWorkflowRepository(authSupabase);
          await workflowRepo.saveDefinition(activeWorkflow, resolvedOrgId);
          let existingInstance = await workflowRepo.getInstanceByCaseId(persistenceResult.id);
          if (!existingInstance) {
            existingInstance = await workflowRepo.createInstance({
              workflowDefinitionId: activeWorkflow.id,
              caseId: persistenceResult.id,
              organizationId: resolvedOrgId || 'org-default',
            });
          }

          // Schritte nach erfolgreicher Analyse als abgeschlossen markieren
          const extractionStep = activeWorkflow.steps[0];
          if (extractionStep) {
            existingInstance = await workflowRepo.updateStepState({
              instanceId: existingInstance.id,
              stepId: extractionStep.id,
              status: WORKFLOW_STEP_STATUS.COMPLETED,
              executedBy: extractionStep.actor,
              metadata: { completedAt: new Date().toISOString() },
            });
          }

          const auditorStep = activeWorkflow.steps.find(
            (s) => s.type === WORKFLOW_STEP_TYPES.AUDITOR
          );
          if (auditorStep) {
            existingInstance = await workflowRepo.updateStepState({
              instanceId: existingInstance.id,
              stepId: auditorStep.id,
              status: WORKFLOW_STEP_STATUS.COMPLETED,
              executedBy: auditorStep.actor,
              metadata: { completedAt: new Date().toISOString() },
            });
          }

          workflowInstance = existingInstance;
        } catch (workflowErr: unknown) {
          logFailure('error', 'workflow_instanzierung_fehlgeschlagen', workflowErr);
          workflowError = 'Der Ablauf des Vorgangs konnte nicht gespeichert werden.';
        }
      }

      emitter.sendEvent({
        type: 'result',
        success: true,
        dossier,
        persistence: persistenceResult,
        workflowError,
        workflow: {
          definitionId: activeWorkflow.id,
          title: activeWorkflow.title,
          instanceId: workflowInstance?.id,
          status: workflowInstance?.status,
          currentStepId: workflowInstance?.currentStepId,
          steps: activeWorkflow.steps.map((s) => ({
            id: s.id,
            title: s.title,
            type: s.type,
            actor: s.actor,
            status: workflowInstance?.stepStates[s.id]?.status || WORKFLOW_STEP_STATUS.PENDING,
          })),
        },
      });

      emitter.close();
    });
  } catch (error: unknown) {
    const denied = authzErrorResponse(error);
    if (denied) return denied;
    logFailure('error', 'analyse_fehlgeschlagen', error);
    return NextResponse.json({ error: 'Analyse fehlgeschlagen.' }, { status: 500 });
  }
}

// Revisionssicherer Audit-Trail (§ 17 ff. BeurkG)
async function appendOverrideAudit(
  authSupabase: Awaited<ReturnType<typeof createServerAuthClient>>,
  params: {
    documentId: string;
    organizationId: string;
    override: NonNullable<UpdateDossierRequest['auditOverride']>;
    dossier: Dossier;
    sessionActor: SessionContext;
  }
): Promise<void> {
  const { documentId, organizationId, override, dossier, sessionActor } = params;
  await getAuditRepository(authSupabase).appendEvent({
    documentId,
    organizationId,
    action: AUDIT_ACTIONS.USER_STATUS_OVERRIDE,
    actor: sessionActor.actorLabel,
    details: { override, caseTitle: dossier.caseTitle, actorRole: sessionActor.role },
  });
}

export async function PUT(req: NextRequest): Promise<Response> {
  try {
    const rawBody: unknown = await req.json().catch(() => ({}));
    const parseResult = UpdateDossierRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const validationError = fromError(parseResult.error);
      return NextResponse.json({ error: validationError.toString() }, { status: 400 });
    }

    const { documentId, dossier, auditOverride } = parseResult.data;

    const authSupabase = await createServerAuthClient();
    const guardOptions = {
      requestedOrgId:
        parseResult.data.organizationId || req.headers.get('x-organization-id') || undefined,
      route: 'PUT /api/analyze',
    };
    const sessionActor = await requirePermission(
      authSupabase,
      PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
      guardOptions
    );
    const { organizationId } = sessionActor;
    if (!authSupabase) throw new Error('Authentifizierungsclient nicht verfügbar.');

    const repo = getDossierRepository(authSupabase);
    // Ein Statuswechsel am Feld gilt als Override, auch wenn der Client `auditOverride` weglässt.
    const stored = await repo.findById(documentId, organizationId);
    const check = checkStatusOverride(stored?.content, dossier, auditOverride);
    if (check.requiresOverride) {
      await requirePermission(authSupabase, PERMISSION_ACTIONS.OVERRIDE_FIELD_STATUS, guardOptions);
    }
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 });
    const updateRes = await repo.update(
      documentId,
      carryOverReviews(stored?.content, dossier),
      organizationId
    );

    if (!updateRes.success) {
      const error = updateRes.error || 'Update fehlgeschlagen';
      return NextResponse.json({ error }, { status: 500 });
    }

    if (check.override) {
      await appendOverrideAudit(authSupabase, {
        documentId,
        organizationId,
        override: check.override,
        dossier,
        sessionActor,
      });
    }

    return NextResponse.json({ success: true, storageType: STORAGE_TYPES.SUPABASE });
  } catch (error: unknown) {
    const denied = authzErrorResponse(error);
    if (denied) return denied;
    if (error instanceof DossierNotFoundError) {
      return NextResponse.json({ error: 'Vorgang nicht gefunden.' }, { status: 404 });
    }
    logFailure('error', 'analyse_update_fehlgeschlagen', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren.' }, { status: 500 });
  }
}
