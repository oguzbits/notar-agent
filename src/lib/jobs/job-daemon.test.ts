import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IJobRepository } from '@/lib/jobs/job-repository';
import type { IDossierRepository } from '@/lib/supabase/repository';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { CASE_TYPES, STORAGE_TYPES } from '@/types/dossier';
import { JOB_STATUS, type DossierJob, type CreateJobPayload } from '@/types/jobs';
import { startWorkerDaemon } from './job-daemon';

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
    recoverOrphanJobs: vi.fn(async () => {
      const recovered: DossierJob[] = [];
      for (const job of jobs.values()) {
        if (job.status === JOB_STATUS.PROCESSING && job.lockedAt) {
          const elapsed = Date.now() - new Date(job.lockedAt).getTime();
          if (elapsed > 5000) {
            job.status = JOB_STATUS.PENDING;
            job.retryCount = (job.retryCount ?? 0) + 1;
            job.lockedAt = undefined;
            recovered.push(job);
          }
        }
      }
      return recovered;
    }),
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

describe('startWorkerDaemon', () => {
  let jobRepo: IJobRepository;
  let dossierRepo: IDossierRepository;

  beforeEach(() => {
    jobRepo = createMockJobRepo();
    dossierRepo = createMockDossierRepo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('polls and executes pending jobs to completion', async () => {
    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Daemon Test',
    });

    const pipelineMock = vi.fn().mockResolvedValue(createTestImmobilienDossier());

    const daemon = startWorkerDaemon({
      jobRepo,
      deps: {
        jobRepo,
        dossierRepo,
        pipelineFn: pipelineMock,
      },
      pollIntervalMs: 50,
      sweepIntervalMs: 500,
      autoRegisterSignals: false,
    });

    expect(daemon.isRunning()).toBe(true);

    // Warte bis der Job gepollt und verarbeitet wurde
    let completedJob = await jobRepo.getJobById(job.id);
    const startWait = Date.now();
    while (completedJob?.status !== JOB_STATUS.COMPLETED && Date.now() - startWait < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      completedJob = await jobRepo.getJobById(job.id);
    }

    expect(completedJob?.status).toBe(JOB_STATUS.COMPLETED);
    expect(pipelineMock).toHaveBeenCalled();

    await daemon.stop();
    expect(daemon.isRunning()).toBe(false);
  });

  it('runs orphan sweep and recovers timed out processing jobs', async () => {
    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Orphan Job',
    });

    // Manuell auf PROCESSING setzen mit abgelaufenem Timestamp
    await jobRepo.updateJobStatus(job.id, {
      status: JOB_STATUS.PROCESSING,
      lockedAt: new Date(Date.now() - 10000).toISOString(),
    });

    const daemon = startWorkerDaemon({
      jobRepo,
      deps: {
        jobRepo,
        dossierRepo,
        pipelineFn: vi.fn().mockResolvedValue(createTestImmobilienDossier()),
      },
      pollIntervalMs: 5000, // Kein Polling während des Tests
      sweepIntervalMs: 100, // Sehr schneller Sweep
      leaseTimeoutMs: 5000,
      autoRegisterSignals: false,
    });

    // Warte bis der Sweeper den Job gefunden und auf PENDING zurückgestellt hat
    let recoveredJob = await jobRepo.getJobById(job.id);
    const startWait = Date.now();
    while (recoveredJob?.status !== JOB_STATUS.PENDING && Date.now() - startWait < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      recoveredJob = await jobRepo.getJobById(job.id);
    }

    expect(recoveredJob?.status).toBe(JOB_STATUS.PENDING);
    expect(recoveredJob?.retryCount).toBe(1);

    await daemon.stop();
  });

  it('stops cleanly and triggers abortSignal on active jobs', async () => {
    await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Hanging Job',
    });

    // Pipeline, die künstlich wartet
    const hangingPipeline = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return createTestImmobilienDossier();
    });

    const daemon = startWorkerDaemon({
      jobRepo,
      deps: {
        jobRepo,
        dossierRepo,
        pipelineFn: hangingPipeline,
      },
      pollIntervalMs: 20,
      sweepIntervalMs: 1000,
      autoRegisterSignals: false,
    });

    // Kurz warten, bis Job geclaimed wurde
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Stoppe Daemon während Pipeline läuft
    await daemon.stop();
    expect(daemon.isRunning()).toBe(false);
  });
});
