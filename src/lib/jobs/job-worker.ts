import pLimit from 'p-limit';
import { PipelineParams } from '@/lib/ai/pipeline';
import { STAGE_ACTIVITY_LABELS_DE } from '@/lib/dossier/constants';
import { IJobRepository } from '@/lib/jobs/job-repository';
import { IDossierRepository } from '@/lib/supabase/repository';
import { getJobRepository, getDossierRepository } from '@/lib/supabase/server';
import { Dossier } from '@/types/dossier';
import { DossierJob, JOB_STATUS, JOB_STAGES, PROGRESS_UNIT_LABELS } from '@/types/jobs';

export interface WorkerDependencies {
  jobRepo?: IJobRepository;
  dossierRepo?: IDossierRepository;
  pipelineFn?: (params: PipelineParams) => Promise<Dossier>;
  abortSignal?: AbortSignal;
}

// Globaler Concurrency-Limiter via p-limit gegen Provider-Rate-Limits (429) bei Lastspitzen
const MAX_CONCURRENT_JOBS = 2;
const limit = pLimit(MAX_CONCURRENT_JOBS);

// Map aktiver AbortController für laufende Jobs zur sofortigen Unterbrechung
const activeJobControllers = new Map<string, AbortController>();

/**
 * Bricht einen aktiven oder wartenden Dossier-Job sofort ab:
 * 1. Signalisiert dem laufenden Worker via AbortController den Abbruch
 * 2. Aktualisiert den Job-Status in der Datenbank auf CANCELLED
 */
export async function cancelDossierJob(
  jobId: string,
  deps: { jobRepo?: IJobRepository } = {}
): Promise<DossierJob | null> {
  const jobRepo = deps.jobRepo ?? getJobRepository();
  const activeController = activeJobControllers.get(jobId);
  if (activeController) {
    activeController.abort();
    activeJobControllers.delete(jobId);
  }

  return jobRepo.updateJobStatus(jobId, {
    status: JOB_STATUS.CANCELLED,
    errorMessage: 'Vorgang durch Benutzer abgebrochen.',
    lockedAt: undefined,
  });
}

/**
 * Führt einen asynchronen Dossier-Job aus:
 * 1. Concurrency-Slot via p-limit akquirieren (Drosselung gegen 429 Rate-Limits)
 * 2. Status auf PROCESSING + QUEUED/PAGE_SPLITTING setzen
 * 3. KI-Pipeline (Extraction + RAG Auditor) aufrufen und Teilschritte melden
 * 4. Dossier im Repository persistieren
 * 5. Status auf COMPLETED oder FAILED setzen (oder PENDING bei Abbruch)
 */
export async function executeDossierJob(
  jobId: string,
  deps: WorkerDependencies = {}
): Promise<DossierJob | null> {
  const jobRepo = deps.jobRepo ?? getJobRepository();
  const dossierRepo = deps.dossierRepo ?? getDossierRepository();

  const internalController = new AbortController();
  activeJobControllers.set(jobId, internalController);

  const combinedSignal = deps.abortSignal
    ? anyAbortSignal([deps.abortSignal, internalController.signal])
    : internalController.signal;

  try {
    return await limit(() =>
      runJobExecution(jobId, jobRepo, dossierRepo, deps.pipelineFn, combinedSignal)
    );
  } finally {
    activeJobControllers.delete(jobId);
  }
}

function anyAbortSignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

async function runJobExecution(
  jobId: string,
  jobRepo: IJobRepository,
  dossierRepo: IDossierRepository,
  pipelineFn?: (params: PipelineParams) => Promise<Dossier>,
  abortSignal?: AbortSignal
): Promise<DossierJob | null> {
  const job = await jobRepo.getJobById(jobId);
  if (!job) {
    return null;
  }

  if (job.status === JOB_STATUS.CANCELLED) {
    return job;
  }

  if (abortSignal?.aborted) {
    // Wenn durch cancelJob bereits CANCELLED gesetzt wurde, beibehalten
    const current = await jobRepo.getJobById(jobId);
    if (current?.status === JOB_STATUS.CANCELLED) {
      return current;
    }
    // Vor Beginn durch Shutdown abgebrochen: Zurück auf PENDING
    return jobRepo.updateJobStatus(jobId, {
      status: JOB_STATUS.PENDING,
      lockedAt: undefined,
    });
  }

  const totalFiles = job.payload.files.length;

  // Job auf PROCESSING setzen mit aktuellem Lease-Lock
  await jobRepo.updateJobStatus(jobId, {
    status: JOB_STATUS.PROCESSING,
    stage: JOB_STAGES.PAGE_SPLITTING,
    lockedAt: new Date().toISOString(),
    progressDetails: {
      currentStep: 1,
      totalSteps: 4,
      processedUnits: 0,
      totalUnits: totalFiles,
      unitLabel: PROGRESS_UNIT_LABELS.DOCUMENTS,
      currentActivity:
        totalFiles > 0
          ? `${totalFiles} Dokument(e) vorbereiten und Layout prüfen...`
          : 'Sachverhaltsnotizen strukturieren...',
    },
  });

  try {
    const { files, caseType, notes, documentId, existingDossier } = job.payload;

    const handleStepUpdate = (step: number, stepDetail: string) => {
      if (step === 1) {
        void jobRepo.updateJobStatus(jobId, {
          stage: JOB_STAGES.EXTRACTION,
          progressDetails: {
            currentStep: 2,
            totalSteps: 4,
            processedUnits: totalFiles,
            totalUnits: totalFiles,
            unitLabel: PROGRESS_UNIT_LABELS.DOCUMENTS,
            currentActivity: stepDetail || STAGE_ACTIVITY_LABELS_DE.EXTRACTION,
          },
        });
      } else if (step === 2) {
        void jobRepo.updateJobStatus(jobId, {
          stage: JOB_STAGES.AUDITING,
          progressDetails: {
            currentStep: 3,
            totalSteps: 4,
            unitLabel: PROGRESS_UNIT_LABELS.FIELDS,
            currentActivity: stepDetail || STAGE_ACTIVITY_LABELS_DE.AUDITING,
          },
        });
      } else if (step === 3) {
        void jobRepo.updateJobStatus(jobId, {
          stage: JOB_STAGES.PERSISTING,
          progressDetails: {
            currentStep: 4,
            totalSteps: 4,
            currentActivity: stepDetail || STAGE_ACTIVITY_LABELS_DE.PERSISTING,
          },
        });
      }
    };

    let dossier: Dossier;
    const { validateEnv } = await import('@/env');
    const currentEnv = validateEnv(process.env);

    if (pipelineFn) {
      dossier = await pipelineFn({
        files,
        caseType,
        notes,
        existingDossier,
        model: {} as PipelineParams['model'],
        extractionInstructions: {} as PipelineParams['extractionInstructions'],
        auditorInstructions: {} as PipelineParams['auditorInstructions'],
        onStep: handleStepUpdate,
      });
    } else if (currentEnv.MOCK_AI) {
      const { runMockSimulation } = await import('@/lib/jobs/mock-simulation');
      dossier = await runMockSimulation({
        files,
        notes,
        onStep: handleStepUpdate,
        stepDelayMs: 6000,
      });
    } else {
      const { getAiConfiguration } = await import('@/lib/ai/ai-provider');
      const { runAnalysisPipeline } = await import('@/lib/ai/pipeline');
      const aiConfig = getAiConfiguration();

      dossier = await runAnalysisPipeline({
        files,
        caseType,
        notes,
        existingDossier,
        model: aiConfig.model,
        extractionInstructions: aiConfig.extractionInstructions,
        auditorInstructions: aiConfig.auditorInstructions,
        onStep: handleStepUpdate,
      });
    }

    // Persistenz-Schritt
    await jobRepo.updateJobStatus(jobId, {
      stage: JOB_STAGES.PERSISTING,
      progressDetails: {
        currentStep: 4,
        totalSteps: 4,
        currentActivity: 'Dossier und Prüfbericht transaktionssicher speichern...',
      },
    });

    let resultDossierId: string;
    const orgId = job.organizationId || job.payload.organizationId;
    if (documentId) {
      await dossierRepo.update(documentId, dossier, orgId);
      resultDossierId = documentId;
    } else {
      const saveRes = await dossierRepo.save(dossier, orgId);
      resultDossierId = saveRes.id;
    }

    return await jobRepo.updateJobStatus(jobId, {
      status: JOB_STATUS.COMPLETED,
      stage: JOB_STAGES.PERSISTING,
      progressDetails: {
        currentStep: 4,
        totalSteps: 4,
        currentActivity: 'Analyse erfolgreich abgeschlossen.',
      },
      resultDossierId,
      lockedAt: undefined,
    });
  } catch (error: unknown) {
    // Prüfen, ob der Job explizit abgebrochen wurde
    const currentJob = await jobRepo.getJobById(jobId);
    if (currentJob?.status === JOB_STATUS.CANCELLED) {
      return currentJob;
    }

    if (abortSignal?.aborted) {
      // Wurde durch Graceful Shutdown unterbrochen: Zurückstellen auf PENDING
      return await jobRepo.updateJobStatus(jobId, {
        status: JOB_STATUS.PENDING,
        lockedAt: undefined,
      });
    }

    const errMsg =
      error instanceof Error
        ? error.message
        : 'Unbekannter Fehler während der Hintergrundverarbeitung.';
    console.error(`[executeDossierJob] Fehler bei Job ${jobId}:`, errMsg);

    return await jobRepo.updateJobStatus(jobId, {
      status: JOB_STATUS.FAILED,
      errorMessage: errMsg,
      retryCount: (job.retryCount || 0) + 1,
      lockedAt: undefined,
    });
  }
}
