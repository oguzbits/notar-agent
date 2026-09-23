import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IJobRepository } from '@/lib/jobs/job-repository';
import { executeDossierJob, WorkerDependencies } from '@/lib/jobs/job-worker';
import { computeJobProgressPercent } from '@/lib/jobs/progress';
import type { IDossierRepository } from '@/lib/supabase/repository';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { CASE_TYPES, STORAGE_TYPES } from '@/types/dossier';
import { JOB_STATUS, JOB_STAGES, type DossierJob, type CreateJobPayload } from '@/types/jobs';

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
    claimNextPendingJob: vi.fn(async () => {
      for (const job of jobs.values()) {
        if (job.status === JOB_STATUS.PENDING) {
          job.status = JOB_STATUS.PROCESSING;
          job.lockedAt = new Date().toISOString();
          return job;
        }
      }
      return null;
    }),
    updateJobStatus: vi.fn(async (id: string, update: Partial<DossierJob>) => {
      const job = jobs.get(id);
      if (!job) return null;
      Object.assign(job, update, { updatedAt: new Date().toISOString() });
      return job;
    }),
    listJobs: vi.fn(async () => [...jobs.values()]),
    recoverOrphanJobs: vi.fn(async () => []),
    pruneCompletedJobs: vi.fn(async () => 0),
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
});
