import { describe, it, expect, beforeEach } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { CreateJobPayload, JOB_STATUS, JOB_STAGES, computeJobProgressPercent } from '@/types/jobs';

import { InMemoryJobRepository } from './job-repository';

describe('InMemoryJobRepository (Bounded FIFO Queue)', () => {
  let repo: InMemoryJobRepository;

  const samplePayload: CreateJobPayload = {
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [
      {
        name: 'kaufvertrag.pdf',
        size: 1024,
        type: 'application/pdf',
        content: 'dummy-base64',
        isBase64: true,
      },
    ],
    notes: 'Sondervereinbarung Übergabe',
  };

  beforeEach(() => {
    repo = new InMemoryJobRepository(10);
  });

  it('creates a new job with initial status PENDING and no progress details', async () => {
    const job = await repo.createJob(samplePayload);

    expect(job.id).toBeDefined();
    expect(job.status).toBe(JOB_STATUS.PENDING);
    expect(job.stage).toBeUndefined();
    expect(job.progressDetails).toBeUndefined();
    expect(computeJobProgressPercent(job)).toBe(0);
    expect(job.payload).toEqual(samplePayload);
    expect(job.retryCount).toBe(0);
    expect(job.createdAt).toBeDefined();
    expect(job.updatedAt).toBeDefined();
  });

  it('retrieves an existing job by id', async () => {
    const created = await repo.createJob(samplePayload);
    const retrieved = await repo.getJobById(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.payload.caseType).toBe(CASE_TYPES.IMMOBILIENKAUF);
  });

  it('returns null for non-existing job id', async () => {
    const result = await repo.getJobById('non-existent-uuid');
    expect(result).toBeNull();
  });

  it('claims next pending job and transitions it to PROCESSING', async () => {
    const created = await repo.createJob(samplePayload);
    const claimed = await repo.claimNextPendingJob();

    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(created.id);
    expect(claimed?.status).toBe(JOB_STATUS.PROCESSING);
    expect(claimed?.stage).toBe(JOB_STAGES.QUEUED);

    // Ein weiterer Claim sollte null liefern, da kein weiterer PENDING Job existiert
    const nextClaim = await repo.claimNextPendingJob();
    expect(nextClaim).toBeNull();
  });

  it('updates job status, stage and progressDetails accurately and computes derived percent', async () => {
    const job = await repo.createJob(samplePayload);

    const updated = await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.PROCESSING,
      stage: JOB_STAGES.EXTRACTION,
      progressDetails: {
        currentStep: 2,
        totalSteps: 4,
        processedUnits: 1,
        totalUnits: 2,
        currentActivity: 'Extrahiere Dokument 1 von 2...',
      },
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe(JOB_STATUS.PROCESSING);
    expect(updated?.stage).toBe(JOB_STAGES.EXTRACTION);
    expect(updated?.progressDetails?.currentStep).toBe(2);
    expect(computeJobProgressPercent(updated!)).toBe(50);

    const completed = await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.COMPLETED,
      stage: JOB_STAGES.PERSISTING,
      progressDetails: {
        currentStep: 4,
        totalSteps: 4,
        processedUnits: 2,
        totalUnits: 2,
        currentActivity: 'Abgeschlossen',
      },
      resultDossierId: 'dossier-12345',
    });

    expect(completed?.status).toBe(JOB_STATUS.COMPLETED);
    expect(completed?.resultDossierId).toBe('dossier-12345');
    expect(computeJobProgressPercent(completed!)).toBe(100);
  });

  it('handles job failure with error message and retry count increment', async () => {
    const job = await repo.createJob(samplePayload);

    const failed = await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.FAILED,
      errorMessage: 'Anthropic API 529 Overloaded',
      retryCount: 1,
    });

    expect(failed?.status).toBe(JOB_STATUS.FAILED);
    expect(failed?.errorMessage).toBe('Anthropic API 529 Overloaded');
    expect(failed?.retryCount).toBe(1);
  });

  it('enforces FIFO capacity bound to prevent memory leaks', async () => {
    const smallRepo = new InMemoryJobRepository(3);

    const job1 = await smallRepo.createJob({ ...samplePayload, notes: 'Job 1' });
    const job2 = await smallRepo.createJob({ ...samplePayload, notes: 'Job 2' });
    const job3 = await smallRepo.createJob({ ...samplePayload, notes: 'Job 3' });
    const job4 = await smallRepo.createJob({ ...samplePayload, notes: 'Job 4' });

    // Job 1 sollte aus dem FIFO-Puffer verdrängt worden sein
    expect(await smallRepo.getJobById(job1.id)).toBeNull();
    expect(await smallRepo.getJobById(job2.id)).not.toBeNull();
    expect(await smallRepo.getJobById(job3.id)).not.toBeNull();
    expect(await smallRepo.getJobById(job4.id)).not.toBeNull();
  });

  it('prunes completed or failed jobs older than maxAgeMs', async () => {
    const job = await repo.createJob(samplePayload);
    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.COMPLETED,
    });

    // Mit maxAgeMs = 0 (alle abgelaufenen löschen)
    const pruned = await repo.pruneCompletedJobs(0);
    expect(pruned).toBe(1);
    expect(await repo.getJobById(job.id)).toBeNull();
  });
});
