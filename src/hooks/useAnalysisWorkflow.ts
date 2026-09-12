'use client';

import { useState } from 'react';
import { Dossier, CaseType } from '@/types/dossier';
import { PreparedFile } from '@/components/UploadZone';

export interface AnalysisStreamResult {
  dossier: Dossier;
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedResult = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'step') {
              if (event.step === 1 || event.step === 2 || event.step === 3) {
                setActiveStep(event.step);
              }
              if (event.stepDetail) {
                setStepDetail(event.stepDetail);
              }
            } else if (event.type === 'result') {
              receivedResult = true;
              onSuccess(event);
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Fehler während der Analyse.');
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message.includes('Analyse')) {
              throw parseErr;
            }
            console.warn('Nicht parsbares SSE-Event:', jsonStr, parseErr);
          }
        }
      }
    } finally {
      reader.releaseLock();
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
