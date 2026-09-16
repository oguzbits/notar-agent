import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryJobRepository } from '@/lib/in-memory';
import { CASE_TYPES } from '@/types/dossier';
import { CreateJobPayload, JOB_STATUS, JOB_STAGES, computeJobProgressPercent } from '@/types/jobs';

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

  it('sets lockedAt when claiming a pending job and re-queues expired PROCESSING jobs via recoverOrphanJobs', async () => {
    const job = await repo.createJob(samplePayload);
    const claimed = await repo.claimNextPendingJob();

    expect(claimed?.status).toBe(JOB_STATUS.PROCESSING);
    expect(claimed?.lockedAt).toBeDefined();

    // 1. Sweeper mit hohem Timeout findet noch nichts (Job ist aktiv)
    const noOrphans = await repo.recoverOrphanJobs(60 * 1000);
    expect(noOrphans.length).toBe(0);

    // 2. Sweeper mit 0ms Timeout erkennt den Job als abgelaufen
    const recovered = await repo.recoverOrphanJobs(0);
    expect(recovered.length).toBe(1);
    expect(recovered[0]?.status).toBe(JOB_STATUS.PENDING);
    expect(recovered[0]?.retryCount).toBe(1);
    expect(recovered[0]?.lockedAt).toBeUndefined();

    // 3. Wenn maxRetries erreicht ist, wechselt er zu FAILED
    const retriedJob = await repo.getJobById(job.id);
    expect(retriedJob?.status).toBe(JOB_STATUS.PENDING);

    // Auf PROCESSING setzen und retryCount auf 3 hochsetzen
    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.PROCESSING,
      retryCount: 2,
      lockedAt: new Date(Date.now() - 10000).toISOString(),
    });

    const exhausted = await repo.recoverOrphanJobs(5000);
    expect(exhausted.length).toBe(1);
    expect(exhausted[0]?.status).toBe(JOB_STATUS.FAILED);
    expect(exhausted[0]?.errorMessage).toContain('Maximale Versuche');
  });

  it('trennt Jobs strikt nach Kanzlei (Organization Isolation gem. § 203 StGB)', async () => {
    const orgA = '550e8400-e29b-41d4-a716-446655440001';
    const orgB = '550e8400-e29b-41d4-a716-446655440002';

    const jobA = await repo.createJob(samplePayload, orgA);
    const jobB = await repo.createJob(samplePayload, orgB);

    // ListJobs filtert nach Kanzlei
    const jobsOrgA = await repo.listJobs(orgA);
    expect(jobsOrgA).toHaveLength(1);
    expect(jobsOrgA[0]?.id).toBe(jobA.id);

    const jobsOrgB = await repo.listJobs(orgB);
    expect(jobsOrgB).toHaveLength(1);
    expect(jobsOrgB[0]?.id).toBe(jobB.id);

    // GetJobById mit Kanzlei-Schutz
    expect(await repo.getJobById(jobA.id, orgB)).toBeNull();
    expect(await repo.getJobById(jobA.id, orgA)).not.toBeNull();

    // ClaimNextPendingJob für Kanzlei B greift nur Job B
    const claimedB = await repo.claimNextPendingJob(orgB);
    expect(claimedB?.id).toBe(jobB.id);
    expect(claimedB?.organizationId).toBe(orgB);

    // Job A ist weiterhin PENDING
    const checkA = await repo.getJobById(jobA.id, orgA);
    expect(checkA?.status).toBe(JOB_STATUS.PENDING);
  });
});

describe('SupabaseJobRepository (Fail-Fast SSOT)', () => {
  const samplePayload: CreateJobPayload = {
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [],
    notes: 'Fail-Fast Test',
  };

  it('fails fast and throws when Supabase insert encounters an error in createJob', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'Connection Timeout' } }),
          }),
        }),
      }),
    };

    const { SupabaseJobRepository } = await import('./job-repository');
    const repo = new SupabaseJobRepository(mockSupabase as never);

    await expect(repo.createJob(samplePayload)).rejects.toThrow(
      'Supabase createJob fehlgeschlagen: Connection Timeout'
    );
  });

  it('fails fast and throws when Supabase query encounters an error in getJobById', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'Table locked' } }),
          }),
        }),
      }),
    };

    const { SupabaseJobRepository } = await import('./job-repository');
    const repo = new SupabaseJobRepository(mockSupabase as never);

    await expect(repo.getJobById('job-123')).rejects.toThrow(
      'Supabase getJobById fehlgeschlagen: Table locked'
    );
  });
});
