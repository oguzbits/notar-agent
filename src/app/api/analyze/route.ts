import { NextRequest, NextResponse } from 'next/server';
import { fromError } from 'zod-validation-error';
import { getAiConfiguration } from '@/lib/ai/ai-provider';
import { runAnalysisPipeline } from '@/lib/ai/pipeline';
import { executeDossierJob } from '@/lib/jobs/job-worker';
import { createSseStream } from '@/lib/sse/create-sse-stream';
import {
  getAuditRepository,
  getDossierRepository,
  getJobRepository,
  getUniformCaseTitle,
} from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { AUDIT_ACTIONS } from '@/types/audit';
import { DB_TABLES } from '@/types/database';
import { AnalyzeRequestSchema, UpdateDossierRequestSchema, STORAGE_TYPES } from '@/types/dossier';

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
      const msg = err instanceof Error ? err.message : 'Kein KI-API-Key konfiguriert.';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Authentifizierten Server-Client & Sitzungskontext abrufen
    const authSupabase = await createServerAuthClient();
    let resolvedOrgId =
      parseResult.data.organizationId || req.headers.get('x-organization-id') || undefined;

    if (authSupabase) {
      const {
        data: { user },
      } = await authSupabase.auth.getUser();

      if (user && !resolvedOrgId) {
        const { data: member } = await authSupabase
          .from(DB_TABLES.ORGANIZATION_MEMBERS)
          .select('organization_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (member?.organization_id) {
          resolvedOrgId = member.organization_id;
        }
      }
    }

    // Prüfen, ob eine asynchrone Verarbeitung angefordert wurde (?async=true oder Header x-async: true)
    const isAsync =
      req.nextUrl.searchParams.get('async') === 'true' ||
      req.headers.get('x-async-mode') === 'true';

    if (isAsync) {
      const jobRepo = getJobRepository(authSupabase);
      const job = await jobRepo.createJob(parseResult.data, resolvedOrgId);

      // Starte Hintergrund-Worker ohne auf Fertigstellung zu blockieren
      void executeDossierJob(job.id);

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

      emitter.sendEvent({
        type: 'result',
        success: true,
        dossier,
        persistence: persistenceResult,
        workflow: {
          type: 'MULTI_AGENT',
          stages: [
            'STAGE_1_INGESTION_EXTRACTION_AGENT',
            'STAGE_2_NOTARY_AUDITOR_RECONCILER_AGENT (DELTA_MODE)',
          ],
        },
      });

      emitter.close();
    });
  } catch (error: unknown) {
    console.error('Analyse-Fehler:', error);
    const message =
      error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.';
    return NextResponse.json({ error: `Analyse fehlgeschlagen: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  try {
    const rawBody: unknown = await req.json().catch(() => ({}));
    const parseResult = UpdateDossierRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const validationError = fromError(parseResult.error);
      return NextResponse.json({ error: validationError.toString() }, { status: 400 });
    }

    const { documentId, dossier, auditOverride, actor, actorRole } = parseResult.data;
    const organizationId =
      parseResult.data.organizationId || req.headers.get('x-organization-id') || undefined;

    const repo = getDossierRepository();
    const updateRes = await repo.update(documentId, dossier, organizationId);

    if (!updateRes.success) {
      return NextResponse.json(
        { error: updateRes.error || 'Update fehlgeschlagen' },
        { status: 500 }
      );
    }

    // Revisionssicherer Audit-Trail (§ 17 ff. BeurkG)
    if (auditOverride) {
      const auditRepo = getAuditRepository();
      await auditRepo.appendEvent({
        documentId,
        organizationId,
        action: AUDIT_ACTIONS.USER_STATUS_OVERRIDE,
        actor: actor || 'Sachbearbeiter(in)',
        details: {
          override: auditOverride,
          caseTitle: dossier.caseTitle,
          actorRole,
        },
      });
    }

    return NextResponse.json({
      success: true,
      storageType: STORAGE_TYPES.SUPABASE,
    });
  } catch (error: unknown) {
    console.error('PUT Analyse Error:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Aktualisieren.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
