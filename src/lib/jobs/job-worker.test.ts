import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IJobRepository } from '@/lib/jobs/job-repository';
import { executeDossierJob, WorkerDependencies } from '@/lib/jobs/job-worker';
import { computeJobProgressPercent } from '@/lib/jobs/progress';
import type { IDossierRepository } from '@/lib/supabase/repository';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { createMockKnowledgeRepository } from '@/test/fixtures/mock-repositories';
import { CASE_TYPES, STORAGE_TYPES } from '@/types/dossier';
import {
  JOB_STATUS,
  JOB_STAGES,
  type DossierJob,
  type CreateJobPayload,
  type JobStatus,
} from '@/types/jobs';

/**
 * Erzeugt ein Mock-JobRepository basierend auf vi.fn(), das Jobs in einer Map verwaltet.
 */
function createMockJobRepo(): IJobRepository {
  const jobs = new Map<string, DossierJob>();
  let idCounter = 0;

  return {
    createJob: vi.fn(async (payload: CreateJobPayload, organizationId?: string) => {
      const id = `job-${++idCounter}`;
      const job: DossierJob = {
        id,
        status: JOB_STATUS.PENDING,
        payload,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        organizationId,
      };
      jobs.set(id, job);
      return job;
    }),
    getJobById: vi.fn(async (id: string) => jobs.get(id) ?? null),
    transitionJob: vi.fn(
      async (id: string, fromStatuses: JobStatus[], update: Partial<DossierJob>) => {
        const job = jobs.get(id);
        if (!job || !fromStatuses.includes(job.status)) return null;
        Object.assign(job, update, { updatedAt: new Date().toISOString() });
        return job;
      }
    ),
    updateJobStatus: vi.fn(async (id: string, update: Partial<DossierJob>) => {
      const job = jobs.get(id);
      if (!job) return null;
      Object.assign(job, update, { updatedAt: new Date().toISOString() });
      return job;
    }),
    listJobs: vi.fn(async () => [...jobs.values()]),
    deleteJob: vi.fn(async (id: string) => jobs.delete(id)),
    recoverOrphanJobs: vi.fn(async () => []),
    pruneCompletedJobs: vi.fn(async () => 0),
    countJobsSince: vi.fn(async () => 0),
  };
}

function createMockDossierRepo(): IDossierRepository {
  return {
    save: vi.fn(async () => ({
      persisted: true,
      id: 'dossier-mock',
      storageType: STORAGE_TYPES.SUPABASE,
      caseNumber: 'IMMOBILIENKAUF - dossier-',
    })),
    update: vi.fn(async () => ({ success: true })),
    findById: vi.fn(async () => null),
    list: vi.fn(async () => []),
    delete: vi.fn(async () => true),
  };
}

describe('job-worker (executeDossierJob)', () => {
  let jobRepo: IJobRepository;
  let dossierRepo: IDossierRepository;

  const mockResultDossier = createTestImmobilienDossier();

  beforeEach(() => {
    jobRepo = createMockJobRepo();
    dossierRepo = createMockDossierRepo();
  });

  it('runs successfully through all stages and sets COMPLETED with resultDossierId', async () => {
    const pipelineMock: NonNullable<WorkerDependencies['pipelineFn']> = async ({ onStep }) => {
      onStep(1, 'Dokumente aufbereiten');
      onStep(2, 'Prüfnormen abgleichen');
      return mockResultDossier;
    };

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'scan.pdf', size: 100, type: 'application/pdf', content: 'test' }],
      notes: '',
    });

    const processedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      pipelineFn: pipelineMock,
    });

    expect(processedJob?.status).toBe(JOB_STATUS.COMPLETED);
    expect(processedJob?.stage).toBe(JOB_STAGES.PERSISTING);
    expect(processedJob?.progressDetails).toBeDefined();
    expect(processedJob?.progressDetails?.currentStep).toBe(4);
    expect(processedJob?.progressDetails?.totalSteps).toBe(4);
    expect(computeJobProgressPercent(processedJob!)).toBe(100);
    expect(processedJob?.resultDossierId).toBeDefined();
  });

  it('catches pipeline errors, updates job to FAILED and increments retryCount', async () => {
    const failingPipeline: NonNullable<WorkerDependencies['pipelineFn']> = async () => {
      throw new Error('Anthropic API 500');
    };

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: '',
    });

    const failedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      pipelineFn: failingPipeline,
    });

    expect(failedJob?.status).toBe(JOB_STATUS.FAILED);
    expect(failedJob?.errorMessage).toContain('Anthropic API 500');
    expect(failedJob?.retryCount).toBe(1);
  });

  it('cancels active job via cancelDossierJob and sets status to CANCELLED', async () => {
    const { cancelDossierJob } = await import('@/lib/jobs/job-worker');

    const slowPipeline: NonNullable<WorkerDependencies['pipelineFn']> = async ({ onStep }) => {
      onStep(1, 'Dokumente aufbereiten');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 5000);
      });
      return mockResultDossier;
    };

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'doc.pdf', size: 100, type: 'application/pdf', content: 'test' }],
      notes: 'Abbruch-Test',
    });

    // Start background execution
    const executionPromise = executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      pipelineFn: slowPipeline,
    });

    // Abbruch anfordern
    const cancelResult = await cancelDossierJob(job.id, { jobRepo });
    expect(cancelResult).not.toBeNull();
    expect(cancelResult?.status).toBe(JOB_STATUS.CANCELLED);

    const finishedJob = await executionPromise;
    expect(finishedJob?.status).toBe(JOB_STATUS.CANCELLED);
  });

  it('runs 2-stage chunking: executes Stage 1, checkpoints stage1Output to DB, and completes Stage 2', async () => {
    const stage1OutputMock = { extractedParties: ['Käufer Schmidt'], rawFacts: {} };
    const extractionMock = vi.fn(async () => ({
      parsedExtractionRaw: stage1OutputMock,
      noteList: [],
      notesSection: '',
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
      extractionTextResult: JSON.stringify(stage1OutputMock),
      validationSuccess: true,
    }));

    const auditorMock = vi.fn(async () => mockResultDossier);
    const sessionKnowledgeRepo = createMockKnowledgeRepository();

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'kaufvertrag.pdf', size: 200, type: 'application/pdf', content: 'test' }],
      notes: 'Testnotiz',
    });

    const finishedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      extractionFn: extractionMock,
      auditorFn: auditorMock,
      knowledgeRepo: sessionKnowledgeRepo,
    });

    expect(extractionMock).toHaveBeenCalledTimes(1);
    expect(auditorMock).toHaveBeenCalledTimes(1);
    expect(auditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage1Output: stage1OutputMock,
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        knowledgeRepo: sessionKnowledgeRepo,
      })
    );

    expect(finishedJob?.status).toBe(JOB_STATUS.COMPLETED);
    expect(finishedJob?.payload.stage1Output).toEqual(stage1OutputMock);
    expect(dossierRepo.save).toHaveBeenCalledTimes(1);
  });

  it('skips Stage 1 when stage1Output checkpoint already exists in job payload', async () => {
    const existingCheckpoint = { preExtracted: true, testField: 'value' };
    const extractionMock = vi.fn();
    const auditorMock = vi.fn(async () => mockResultDossier);

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: '',
      stage1Output: existingCheckpoint,
    });

    const finishedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      extractionFn: extractionMock,
      auditorFn: auditorMock,
    });

    // Stufe 1 darf NICHT erneut aufgerufen werden
    expect(extractionMock).not.toHaveBeenCalled();
    // Stufe 2 wird direkt mit dem existierenden Checkpoint ausgeführt
    expect(auditorMock).toHaveBeenCalledTimes(1);
    expect(auditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stage1Output: existingCheckpoint,
      })
    );

    expect(finishedJob?.status).toBe(JOB_STATUS.COMPLETED);
  });

  it('führt einen nicht wartenden Job nicht aus (kein Doppellauf)', async () => {
    const pipeline = vi.fn(async () => mockResultDossier);
    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: '',
    });
    await jobRepo.updateJobStatus(job.id, { status: JOB_STATUS.PROCESSING });

    const result = await executeDossierJob(job.id, { jobRepo, dossierRepo, pipelineFn: pipeline });

    expect(pipeline).not.toHaveBeenCalled();
    expect(result?.status).toBe(JOB_STATUS.PROCESSING);
  });
});
