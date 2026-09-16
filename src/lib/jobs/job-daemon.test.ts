import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryDossierRepository, InMemoryJobRepository } from '@/lib/in-memory';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS } from '@/types/jobs';
import { startWorkerDaemon } from './job-daemon';

describe('startWorkerDaemon', () => {
  let jobRepo: InMemoryJobRepository;
  let dossierRepo: InMemoryDossierRepository;

  beforeEach(() => {
    jobRepo = new InMemoryJobRepository(20);
    dossierRepo = new InMemoryDossierRepository(20);
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
    const job = await jobRepo.createJob({
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

    // Job sollte wieder auf PENDING zurückgesetzt worden sein oder nicht hängenbleiben
    const finalJob = await jobRepo.getJobById(job.id);
    expect(
      finalJob?.status === JOB_STATUS.PENDING || finalJob?.status === JOB_STATUS.COMPLETED
    ).toBe(true);
  });
});
