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
  getServerSupabase,
  getUniformCaseTitle,
} from '@/lib/supabase/server';
import { AUDIT_ACTIONS } from '@/types/audit';
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

    // Prüfen, ob eine asynchrone Verarbeitung angefordert wurde (?async=true oder Header x-async: true)
    const isAsync =
      req.nextUrl.searchParams.get('async') === 'true' ||
      req.headers.get('x-async-mode') === 'true';

    if (isAsync) {
      const jobRepo = getJobRepository();
      const job = await jobRepo.createJob(parseResult.data);

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

      const repo = getDossierRepository();
      let persistenceResult;
      if (documentId) {
        const updateRes = await repo.update(documentId, dossier);
        const isSupabase = !!getServerSupabase();
        const uniformTitle = getUniformCaseTitle(dossier.caseType, documentId);
        persistenceResult = {
          persisted: updateRes.success,
          storageType: isSupabase ? STORAGE_TYPES.SUPABASE : STORAGE_TYPES.IN_MEMORY,
          caseNumber: uniformTitle,
          id: documentId,
        };
      } else {
        persistenceResult = await repo.save(dossier);
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

    const { documentId, dossier, auditOverride, actor } = parseResult.data;

    const repo = getDossierRepository();
    const updateRes = await repo.update(documentId, dossier);

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
        action: AUDIT_ACTIONS.USER_STATUS_OVERRIDE,
        actor: actor || 'Sachbearbeiter(in)',
        details: {
          override: auditOverride,
          caseTitle: dossier.caseTitle,
        },
      });
    }

    return NextResponse.json({
      success: true,
      storageType: getServerSupabase() ? STORAGE_TYPES.SUPABASE : STORAGE_TYPES.IN_MEMORY,
    });
  } catch (error: unknown) {
    console.error('PUT Analyse Error:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Aktualisieren.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
