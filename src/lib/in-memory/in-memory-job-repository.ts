import { IJobRepository, UpdateJobParams } from '@/lib/jobs/job-repository';
import { CreateJobPayload, DossierJob, JOB_STATUS, JOB_STAGES } from '@/types/jobs';

/**
 * Bounded In-Memory Job Queue mit FIFO-Verdrängung gegen Memory Leaks und Mandantentrennung (§ 203 StGB).
 * Garantiert Zero-Config Portability ohne laufende Datenbank für lokale Demos und isolierte Tests.
 */
export class InMemoryJobRepository implements IJobRepository {
  private jobs: DossierJob[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 50) {
    this.maxCapacity = maxCapacity;
  }

  async createJob(payload: CreateJobPayload, organizationId?: string): Promise<DossierJob> {
    const now = new Date().toISOString();
    const job: DossierJob = {
      id: crypto.randomUUID(),
      organizationId,
      status: JOB_STATUS.PENDING,
      payload,
      retryCount: 0,
      maxRetries: 3,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.unshift(job);
    if (this.jobs.length > this.maxCapacity) {
      this.jobs.pop(); // FIFO: Ältestes Element entfernen
    }

    return job;
  }

  async getJobById(id: string, organizationId?: string): Promise<DossierJob | null> {
    const job = this.jobs.find((j) => {
      if (j.id !== id) return false;
      if (organizationId && j.organizationId && j.organizationId !== organizationId) return false;
      return true;
    });
    return job ? { ...job } : null;
  }

  async updateJobStatus(id: string, update: UpdateJobParams): Promise<DossierJob | null> {
    const index = this.jobs.findIndex((j) => j.id === id);
    if (index === -1) {
      return null;
    }

    const current = this.jobs[index];
    if (!current) return null;

    const updated: DossierJob = {
      ...current,
      status: update.status ?? current.status,
      stage: update.stage ?? current.stage,
      progressDetails: update.progressDetails ?? current.progressDetails,
      resultDossierId: update.resultDossierId ?? current.resultDossierId,
      errorMessage: update.errorMessage ?? current.errorMessage,
      retryCount: update.retryCount ?? current.retryCount,
      lockedAt: 'lockedAt' in update ? update.lockedAt : current.lockedAt,
      updatedAt: new Date().toISOString(),
    };

    this.jobs[index] = updated;
    return { ...updated };
  }

  async claimNextPendingJob(organizationId?: string): Promise<DossierJob | null> {
    // Finde den ältesten PENDING Job (Kandidat von hinten im unshifted Array)
    let candidateIndex = -1;
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      const job = this.jobs[i];
      if (!job) continue;
      if (job.status === JOB_STATUS.PENDING) {
        if (!organizationId || !job.organizationId || job.organizationId === organizationId) {
          candidateIndex = i;
          break;
        }
      }
    }

    if (candidateIndex === -1) {
      return null;
    }

    const job = this.jobs[candidateIndex];
    if (!job) return null;

    return this.updateJobStatus(job.id, {
      status: JOB_STATUS.PROCESSING,
      stage: JOB_STAGES.QUEUED,
      lockedAt: new Date().toISOString(),
    });
  }

  async listJobs(organizationId?: string): Promise<DossierJob[]> {
    const filtered = organizationId
      ? this.jobs.filter((j) => !j.organizationId || j.organizationId === organizationId)
      : this.jobs;
    return filtered.map((j) => ({ ...j }));
  }

  async pruneCompletedJobs(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const initialCount = this.jobs.length;

    this.jobs = this.jobs.filter((j) => {
      const isTerminal = j.status === JOB_STATUS.COMPLETED || j.status === JOB_STATUS.FAILED;
      const jobTime = new Date(j.updatedAt).getTime();
      return !isTerminal || jobTime > cutoff;
    });

    return initialCount - this.jobs.length;
  }

  async recoverOrphanJobs(
    leaseTimeoutMs = 5 * 60 * 1000,
    organizationId?: string
  ): Promise<DossierJob[]> {
    const now = Date.now();
    const cutoff = now - leaseTimeoutMs;
    const recovered: DossierJob[] = [];

    for (let i = 0; i < this.jobs.length; i++) {
      const job = this.jobs[i];
      if (!job || job.status !== JOB_STATUS.PROCESSING) continue;
      if (organizationId && job.organizationId && job.organizationId !== organizationId) continue;

      const lockTimestamp = job.lockedAt
        ? new Date(job.lockedAt).getTime()
        : new Date(job.updatedAt).getTime();

      if (lockTimestamp <= cutoff) {
        const nextRetry = (job.retryCount || 0) + 1;
        const isExhausted = nextRetry >= job.maxRetries;

        const updated = await this.updateJobStatus(job.id, {
          status: isExhausted ? JOB_STATUS.FAILED : JOB_STATUS.PENDING,
          errorMessage: isExhausted
            ? `Maximale Versuche (${job.maxRetries}) nach Timeout/Absturz überschritten.`
            : 'Verwaister Job nach Timeout reaktiviert.',
          retryCount: nextRetry,
          lockedAt: undefined,
        });

        if (updated) {
          recovered.push(updated);
        }
      }
    }

    return recovered;
  }
}
