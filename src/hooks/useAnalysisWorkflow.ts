'use client';

import { useState } from 'react';
import { PreparedFile } from '@/components/UploadZone';
import { parseSseStream } from '@/lib/sse/parse-sse-stream';
import { Dossier, CaseType } from '@/types/dossier';

export interface AnalysisStreamResult {
  dossier: Dossier;
  persistence?: {
    id?: string;
    storageType: 'supabase' | 'in-memory';
    caseNumber: string;
  };
}

interface SSEAnalysisEvent {
  type: 'step' | 'result' | 'error';
  step?: number;
  stepDetail?: string;
  error?: string;
  dossier?: Dossier;
  persistence?: {
    id?: string;
    storageType: 'supabase' | 'in-memory';
    caseNumber: string;
  };
}

export function useAnalysisWorkflow() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [stepDetail, setStepDetail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processAnalysisStream = async (
    response: Response,
    onSuccess: (result: AnalysisStreamResult) => void
  ) => {
    if (!response.body) {
      throw new Error('Kein Response-Body vom Analyse-Dienst erhalten.');
    }

    let receivedResult = false;

    for await (const event of parseSseStream<SSEAnalysisEvent>(response.body)) {
      if (event.type === 'step') {
        if (event.step === 1 || event.step === 2 || event.step === 3) {
          setActiveStep(event.step);
        }
        if (event.stepDetail) {
          setStepDetail(event.stepDetail);
        }
      } else if (event.type === 'result') {
        if (event.dossier) {
          receivedResult = true;
          onSuccess({
            dossier: event.dossier,
            persistence: event.persistence,
          });
        }
      } else if (event.type === 'error') {
        throw new Error(event.error || 'Fehler während der Analyse.');
      }
    }

    if (!receivedResult) {
      throw new Error(
        'Die Analyse wurde ohne abschließendes Ergebnis beendet. Bitte versuchen Sie es erneut.'
      );
    }
  };

  const startAnalysis = async (
    files: PreparedFile[],
    caseType: CaseType,
    notes: string,
    onComplete: (result: AnalysisStreamResult) => void
  ) => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    setActiveStep(1);
    setStepDetail('Dateien werden vorbereitet...');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
            content: f.content,
            isBase64: f.isBase64,
          })),
          caseType,
          notes,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Server meldete Status ${response.status}: ${response.statusText}`
        );
      }

      await processAnalysisStream(response, (result) => {
        onComplete(result);
      });

      setErrorMessage(null);
    } catch (err: unknown) {
      console.error('Analyse Error:', err);
      const msg = err instanceof Error ? err.message : 'Netzwerk- oder Serverfehler.';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsAnalyzing(false);
      setActiveStep(1);
      setStepDetail('');
    }
  };

  const startAppendAnalysis = async (
    activeDocumentId: string | null,
    currentDossier: Dossier,
    appendFiles: PreparedFile[],
    appendNotes: string,
    onComplete: (result: AnalysisStreamResult) => void
  ) => {
    if (appendFiles.length === 0 && !appendNotes.trim()) return;

    setIsAnalyzing(true);
    setActiveStep(1);
    setStepDetail('Neue Unterlagen werden vorbereitet...');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: appendFiles.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
            content: f.content,
            isBase64: f.isBase64,
          })),
          caseType: currentDossier.caseType,
          notes: appendNotes,
          existingDossier: currentDossier,
          documentId: activeDocumentId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Server meldete Status ${response.status}: ${response.statusText}`
        );
      }

      await processAnalysisStream(response, (result) => {
        onComplete(result);
      });

      setErrorMessage(null);
    } catch (err: unknown) {
      console.error('Append Analyse Error:', err);
      const msg = err instanceof Error ? err.message : 'Netzwerk- oder Serverfehler.';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsAnalyzing(false);
      setActiveStep(1);
      setStepDetail('');
    }
  };

  return {
    isAnalyzing,
    activeStep,
    stepDetail,
    errorMessage,
    setErrorMessage,
    startAnalysis,
    startAppendAnalysis,
  };
}
