import { PipelineParams } from '@/lib/ai/pipeline';
import { IJobRepository } from '@/lib/jobs/job-repository';
import { IDossierRepository } from '@/lib/supabase/repository';
import { getJobRepository, getDossierRepository } from '@/lib/supabase/server';
import { Dossier } from '@/types/dossier';
import { DossierJob, JOB_STATUS, JOB_STAGES, PROGRESS_UNIT_LABELS } from '@/types/jobs';

export interface WorkerDependencies {
  jobRepo?: IJobRepository;
  dossierRepo?: IDossierRepository;
  pipelineFn?: (params: PipelineParams) => Promise<Dossier>;
}

// Globaler Concurrency-Limiter gegen Provider-Rate-Limits (429) bei Lastspitzen
const MAX_CONCURRENT_JOBS = 2;
let activeJobCount = 0;
const waitingQueue: Array<() => void> = [];

function acquireJobSlot(): Promise<void> {
  if (activeJobCount < MAX_CONCURRENT_JOBS) {
    activeJobCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitingQueue.push(() => {
      activeJobCount++;
      resolve();
    });
  });
}

function releaseJobSlot(): void {
  activeJobCount--;
  const next = waitingQueue.shift();
  if (next) {
    next();
  }
}

/**
 * Führt einen asynchronen Dossier-Job aus:
 * 1. Concurrency-Slot akquirieren (Drosselung gegen 429 Rate-Limits)
 * 2. Status auf PROCESSING + QUEUED/PAGE_SPLITTING setzen
 * 3. KI-Pipeline (Extraction + RAG Auditor) aufrufen und Teilschritte melden
 * 4. Dossier im Repository persistieren
 * 5. Status auf COMPLETED oder FAILED setzen
 */
export async function executeDossierJob(
  jobId: string,
  deps: WorkerDependencies = {}
): Promise<DossierJob | null> {
  const jobRepo = deps.jobRepo ?? getJobRepository();
  const dossierRepo = deps.dossierRepo ?? getDossierRepository();

  await acquireJobSlot();
  try {
    return await runJobExecution(jobId, jobRepo, dossierRepo, deps.pipelineFn);
  } finally {
    releaseJobSlot();
  }
}

async function runJobExecution(
  jobId: string,
  jobRepo: IJobRepository,
  dossierRepo: IDossierRepository,
  pipelineFn?: (params: PipelineParams) => Promise<Dossier>
): Promise<DossierJob | null> {
  const job = await jobRepo.getJobById(jobId);
  if (!job) {
    return null;
  }

  const totalFiles = job.payload.files.length;

  // Job auf PROCESSING setzen
  await jobRepo.updateJobStatus(jobId, {
    status: JOB_STATUS.PROCESSING,
    stage: JOB_STAGES.PAGE_SPLITTING,
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
            currentActivity:
              stepDetail || 'Extraktion der Stammdaten, Flurstücke und Beteiligten...',
          },
        });
      } else if (step === 2) {
        void jobRepo.updateJobStatus(jobId, {
          stage: JOB_STAGES.AUDITING,
          progressDetails: {
            currentStep: 3,
            totalSteps: 4,
            unitLabel: PROGRESS_UNIT_LABELS.FIELDS,
            currentActivity:
              stepDetail || 'Notary Auditor: Prüfnormen (BGB, BeurkG, GBO) abgleichen...',
          },
        });
      } else if (step === 3) {
        void jobRepo.updateJobStatus(jobId, {
          stage: JOB_STAGES.PERSISTING,
          progressDetails: {
            currentStep: 4,
            totalSteps: 4,
            currentActivity: stepDetail || 'Prüfbericht & Cockpit-Aufbereitung...',
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
    if (documentId) {
      await dossierRepo.update(documentId, dossier);
      resultDossierId = documentId;
    } else {
      const saveRes = await dossierRepo.save(dossier);
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
    });
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error
        ? error.message
        : 'Unbekannter Fehler während der Hintergrundverarbeitung.';
    console.error(`[executeDossierJob] Fehler bei Job ${jobId}:`, errMsg);

    return await jobRepo.updateJobStatus(jobId, {
      status: JOB_STATUS.FAILED,
      errorMessage: errMsg,
      retryCount: (job.retryCount || 0) + 1,
    });
  }
}
