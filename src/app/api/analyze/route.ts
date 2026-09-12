import { NextRequest, NextResponse } from 'next/server';
import { getAiConfiguration } from '@/lib/ai/ai-provider';
import { runAnalysisPipeline, type UploadedFilePayload } from '@/lib/ai/pipeline';
import { createSseStream } from '@/lib/sse/create-sse-stream';
import {
  getDossierRepository,
  getServerSupabase,
  getUniformCaseTitle,
} from '@/lib/supabase/server';
import { CaseType, Dossier } from '@/types/dossier';

export const maxDuration = 60; // Erlaube bis zu 60s Laufzeit für Dokumentenanalysen

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const files: UploadedFilePayload[] = body.files || [];
    const caseType: CaseType = body.caseType || 'IMMOBILIENKAUF';
    const notes: string = body.notes || '';
    const documentId: string | undefined = body.documentId;
    const existingDossier: Dossier | undefined = body.existingDossier;

    if (!files || files.length === 0) {
      if (!existingDossier || !notes.trim()) {
        return NextResponse.json(
          { error: 'Keine Dokumente oder Notizen für die Aktualisierung übermittelt.' },
          { status: 400 }
        );
      }
    }

    let aiConfig;
    try {
      aiConfig = getAiConfiguration();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kein KI-API-Key konfiguriert.';
      return NextResponse.json({ error: msg }, { status: 500 });
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
          storageType: isSupabase ? ('supabase' as const) : ('in-memory' as const),
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

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentId, dossier } = body;

    if (!documentId || !dossier) {
      return NextResponse.json(
        { error: 'documentId und dossier sind erforderlich.' },
        { status: 400 }
      );
    }

    const repo = getDossierRepository();
    const updateRes = await repo.update(documentId, dossier);

    if (!updateRes.success) {
      return NextResponse.json(
        { error: updateRes.error || 'Update fehlgeschlagen' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      storageType: getServerSupabase() ? 'supabase' : 'in-memory',
    });
  } catch (error: unknown) {
    console.error('PUT Analyse Error:', error);
    const message = error instanceof Error ? error.message : 'Fehler beim Aktualisieren.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
