import pLimit from 'p-limit';
import type {
  PipelineParams,
  ExtractionStageParams,
  ExtractionStageResult,
  AuditorStageParams,
} from '@/lib/ai/pipeline';
import { createUsageRecorder, ILlmUsageRepository } from '@/lib/ai/usage-repository';
import type { IAuditRepository } from '@/lib/audit/audit-repository';
import { STAGE_ACTIVITY_LABELS_DE } from '@/lib/dossier/constants';
import { recordPruefgrundlage } from '@/lib/jobs/audit-pruefgrundlage';
import { IJobRepository } from '@/lib/jobs/job-repository';
import type { IKnowledgeRepository } from '@/lib/knowledge/knowledge-repository';
import { logFailure } from '@/lib/observability/logger';
import { IDossierRepository } from '@/lib/supabase/repository';
import { getJobRepository, getDossierRepository } from '@/lib/supabase/server';
import { Dossier } from '@/types/dossier';
import {
  DossierJob,
  JOB_STATUS,
  JOB_STAGES,
  PROGRESS_UNIT_LABELS,
  type UpdateJobParams,
} from '@/types/jobs';

export interface WorkerDependencies {
  jobRepo?: IJobRepository;
  dossierRepo?: IDossierRepository;
  /** Wissensspeicher mit Sitzungskontext, damit RLS die Regeln der Kanzlei freigibt */
  knowledgeRepo?: IKnowledgeRepository;
  /** Prüfprotokoll; ohne Repository wird kein Eintrag zur Prüfgrundlage geschrieben */
  auditRepo?: IAuditRepository;
  /** Verbrauchserfassung; ohne Repository wird nichts erfasst */
  usageRepo?: ILlmUsageRepository;
  pipelineFn?: (params: PipelineParams) => Promise<Dossier>;
  extractionFn?: (params: ExtractionStageParams) => Promise<ExtractionStageResult>;
  auditorFn?: (params: AuditorStageParams) => Promise<Dossier>;
  abortSignal?: AbortSignal;
}

// Globaler Concurrency-Limiter via p-limit gegen Provider-Rate-Limits (429) bei Lastspitzen
const MAX_CONCURRENT_JOBS = 2;
const limit = pLimit(MAX_CONCURRENT_JOBS);

// Map aktiver AbortController für laufende Jobs zur sofortigen Unterbrechung
const activeJobControllers = new Map<string, AbortController>();

/**
 * Bricht einen aktiven oder wartenden Dossier-Job ab:
 * 1. Setzt den Status bedingt (nur aus PENDING/PROCESSING) auf CANCELLED
 * 2. Signalisiert einem Worker in diesem Prozess den Abbruch; Worker in anderen
 *    Instanzen erkennen ihn am Status, weil ihre Übergänge dann ins Leere laufen
 */
export async function cancelDossierJob(
  jobId: string,
  deps: { jobRepo?: IJobRepository } = {}
): Promise<DossierJob | null> {
  const jobRepo = deps.jobRepo ?? getJobRepository();
  const cancelled = await jobRepo.transitionJob(
    jobId,
    [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING],
    {
      status: JOB_STATUS.CANCELLED,
      errorMessage: 'Vorgang durch Benutzer abgebrochen.',
      lockedAt: null,
    },
    // Ab der Speicherstufe nicht mehr abbrechbar: Das Dossier wird sonst gespeichert, der Job aber CANCELLED
    { stageNot: JOB_STAGES.PERSISTING }
  );
  // Abgeschlossen, gescheitert oder schon beim Speichern: nichts überschreiben
  if (!cancelled) return jobRepo.getJobById(jobId);

  activeJobControllers.get(jobId)?.abort();
  activeJobControllers.delete(jobId);
  return cancelled;
}

/**
 * Führt einen asynchronen Dossier-Job aus:
 * 1. Concurrency-Slot via p-limit akquirieren (Drosselung gegen 429 Rate-Limits)
 * 2. Status auf PROCESSING + QUEUED/PAGE_SPLITTING setzen
 * 3. KI-Pipeline (Extraction + RAG Auditor) aufrufen und Teilschritte melden
 * 4. Dossier im Repository persistieren
 * 5. Status bedingt (nur aus PROCESSING) auf COMPLETED oder FAILED setzen
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
    ? AbortSignal.any([deps.abortSignal, internalController.signal])
    : internalController.signal;

  try {
    return await limit(() => runJobExecution(jobId, jobRepo, dossierRepo, deps, combinedSignal));
  } finally {
    // Ein späterer Lauf desselben Jobs kann schon einen eigenen Controller eingetragen haben
    if (activeJobControllers.get(jobId) === internalController) activeJobControllers.delete(jobId);
  }
}

async function runJobExecution(
  jobId: string,
  jobRepo: IJobRepository,
  dossierRepo: IDossierRepository,
  deps: WorkerDependencies,
  abortSignal?: AbortSignal
): Promise<DossierJob | null> {
  const job = await jobRepo.getJobById(jobId);
  if (!job) {
    return null;
  }

  if (job.status === JOB_STATUS.CANCELLED) {
    return job;
  }

  // Vor Beginn abgebrochen: Job bleibt, wie er ist (wartend oder bereits CANCELLED)
  if (abortSignal?.aborted) {
    return jobRepo.getJobById(jobId);
  }

  const totalFiles = job.payload.files.length;
  let stage1Output = job.payload.stage1Output;
  const onStageUsage =
    deps.usageRepo && (job.organizationId || job.payload.organizationId)
      ? createUsageRecorder(
          deps.usageRepo,
          (job.organizationId || job.payload.organizationId) as string,
          jobId
        )
      : undefined;
  const orgId = job.organizationId || job.payload.organizationId;

  // Job auf PROCESSING setzen mit aktuellem Lease-Lock.
  // Falls stage1Output bereits vorliegt, direkt in Stufe 2 (AUDITING) einsteigen!
  const runLockedAt = new Date().toISOString();
  const claimed = await jobRepo.transitionJob(jobId, [JOB_STATUS.PENDING], {
    status: JOB_STATUS.PROCESSING,
    stage: stage1Output ? JOB_STAGES.AUDITING : JOB_STAGES.PAGE_SPLITTING,
    lockedAt: runLockedAt,
    progressDetails: {
      currentStep: stage1Output ? 3 : 1,
      totalSteps: 4,
      processedUnits: stage1Output ? totalFiles : 0,
      totalUnits: totalFiles,
      unitLabel: stage1Output ? PROGRESS_UNIT_LABELS.FIELDS : PROGRESS_UNIT_LABELS.DOCUMENTS,
      currentActivity: stage1Output
        ? 'Stufe-1-Checkpoint geladen. Notarielle Vorprüfung (Stufe 2) starten...'
        : totalFiles > 0
          ? `${totalFiles} Dokument(e) vorbereiten und Layout prüfen...`
          : 'Sachverhaltsnotizen strukturieren...',
    },
  });
  // Ein anderer Lauf hat den Job bereits übernommen oder er ist nicht mehr wartend
  if (!claimed) return jobRepo.getJobById(jobId);

  // Nur der eigene, noch laufende Lauf darf ändern; abgebrochene, geheilte oder neu gestartete Jobs bleiben unberührt
  const whileProcessing = (update: UpdateJobParams) =>
    jobRepo.transitionJob(jobId, [JOB_STATUS.PROCESSING], update, { lockedAt: runLockedAt });
  // Abgebrochen oder geheilt: weiterarbeiten wäre verschwendet, der Fehlerpfad lässt den Status stehen
  const advance = async (update: UpdateJobParams) => {
    if (!(await whileProcessing(update))) throw new Error('Vorgang läuft nicht mehr.');
  };
  const reportProgress = (update: UpdateJobParams) => {
    whileProcessing(update).catch((err: unknown) => {
      logFailure('warn', 'fortschritt_fehlgeschlagen', err);
    });
  };

  try {
    const { files, caseType, notes, documentId, existingDossier } = job.payload;

    const handleStepUpdate = (step: number, stepDetail: string) => {
      if (step === 1) {
        reportProgress({
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
        reportProgress({
          stage: JOB_STAGES.AUDITING,
          progressDetails: {
            currentStep: 3,
            totalSteps: 4,
            unitLabel: PROGRESS_UNIT_LABELS.FIELDS,
            currentActivity: stepDetail || STAGE_ACTIVITY_LABELS_DE.AUDITING,
          },
        });
      } else if (step === 3) {
        reportProgress({
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

    if (deps.pipelineFn) {
      dossier = await deps.pipelineFn({
        files,
        caseType,
        notes,
        existingDossier,
        model: {} as PipelineParams['model'],
        extractionInstructions: {} as PipelineParams['extractionInstructions'],
        auditorInstructions: {} as PipelineParams['auditorInstructions'],
        onStep: handleStepUpdate,
        abortSignal,
      });
    } else if (currentEnv.MOCK_AI && !deps.extractionFn && !deps.auditorFn) {
      const { runMockSimulation } = await import('@/lib/jobs/mock-simulation');
      dossier = await runMockSimulation({
        files,
        notes,
        onStep: handleStepUpdate,
        stepDelayMs: 6000,
        abortSignal,
      });
    } else {
      // 2-Stufen-Job-Chunking für Serverless Runtime Resilience (60s-Budget je Stufe)
      const { runExtractionStage, runAuditorStage } = await import('@/lib/ai/pipeline');

      let aiConfig: {
        model: PipelineParams['model'];
        extractionInstructions: PipelineParams['extractionInstructions'];
        auditorInstructions: PipelineParams['auditorInstructions'];
      } = {
        model: {} as PipelineParams['model'],
        extractionInstructions: { role: 'system', content: '' },
        auditorInstructions: { role: 'system', content: '' },
      };

      if (!deps.extractionFn || !deps.auditorFn) {
        const { getAiConfiguration } = await import('@/lib/ai/ai-provider');
        aiConfig = getAiConfiguration();
      }

      const runExtraction = deps.extractionFn ?? runExtractionStage;
      const runAuditor = deps.auditorFn ?? runAuditorStage;

      let noteList: string[] | undefined;
      let notesSection: string | undefined;

      // Stufe 1: Ingestion & Extraction (nur ausführen, falls noch kein Checkpoint in job.payload existiert)
      if (!stage1Output) {
        handleStepUpdate(1, STAGE_ACTIVITY_LABELS_DE.EXTRACTION);
        const extractionResult = await runExtraction({
          files,
          caseType,
          notes,
          existingDossier,
          model: aiConfig.model,
          extractionInstructions: aiConfig.extractionInstructions,
          onStep: handleStepUpdate,
          onStageUsage,
          abortSignal,
        });

        stage1Output = extractionResult.parsedExtractionRaw;
        noteList = extractionResult.noteList;
        notesSection = extractionResult.notesSection;

        // Checkpoint in Postgres persistieren für Serverless Timeout-Resilienz und Wiederanlauf
        await advance({
          stage: JOB_STAGES.AUDITING,
          payload: {
            ...job.payload,
            stage1Output,
          },
          progressDetails: {
            currentStep: 3,
            totalSteps: 4,
            unitLabel: PROGRESS_UNIT_LABELS.FIELDS,
            currentActivity: STAGE_ACTIVITY_LABELS_DE.AUDITING,
          },
        });
      }

      // Stufe 2: Notary Auditor & Reconciler
      handleStepUpdate(2, STAGE_ACTIVITY_LABELS_DE.AUDITING);
      dossier = await runAuditor({
        stage1Output,
        caseType,
        notes,
        noteList,
        notesSection,
        existingDossier,
        organizationId: orgId,
        knowledgeRepo: deps.knowledgeRepo,
        model: aiConfig.model,
        auditorInstructions: aiConfig.auditorInstructions,
        onStep: handleStepUpdate,
        onStageUsage,
        abortSignal,
      });
    }
    abortSignal?.throwIfAborted();

    // Persistenz-Schritt: Ein nicht mehr laufender Job speichert kein Dossier
    await advance({
      stage: JOB_STAGES.PERSISTING,
      progressDetails: {
        currentStep: 4,
        totalSteps: 4,
        currentActivity: 'Dossier und Prüfbericht transaktionssicher speichern...',
      },
    });

    if (documentId) await dossierRepo.update(documentId, dossier, orgId);
    const resultDossierId = documentId ?? (await dossierRepo.save(dossier, orgId)).id;

    await recordPruefgrundlage(deps, resultDossierId, orgId, job.payload);

    const completed = await whileProcessing({
      status: JOB_STATUS.COMPLETED,
      stage: JOB_STAGES.PERSISTING,
      progressDetails: {
        currentStep: 4,
        totalSteps: 4,
        currentActivity: 'Analyse erfolgreich abgeschlossen.',
      },
      resultDossierId,
      lockedAt: null,
    });
    return completed ?? (await jobRepo.getJobById(jobId));
  } catch (error: unknown) {
    if (abortSignal?.aborted) {
      // Benutzerabbruch hat CANCELLED schon gesetzt (Übergang trifft nichts); Shutdown stellt zurück auf PENDING
      const requeued = await whileProcessing({ status: JOB_STATUS.PENDING, lockedAt: null });
      return requeued ?? (await jobRepo.getJobById(jobId));
    }

    // Rohe Modell-/DB-Texte können Mandantendaten enthalten: Nutzer sehen eine feste Meldung
    logFailure('error', 'job_fehlgeschlagen', error);

    // retryCount zählt allein der Requeue (POST /api/jobs)
    const failed = await whileProcessing({
      status: JOB_STATUS.FAILED,
      errorMessage: 'Verarbeitung fehlgeschlagen. Bitte Vorgang erneut starten.',
      lockedAt: null,
    });
    return failed ?? (await jobRepo.getJobById(jobId));
  }
}
