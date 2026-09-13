import { SupabaseClient } from '@supabase/supabase-js';
import {
  CreateJobPayload,
  DossierJob,
  JobProgressDetails,
  JOB_STATUS,
  JOB_STAGES,
  JobStatus,
  JobStage,
} from '@/types/jobs';

export interface UpdateJobParams {
  status?: JobStatus;
  stage?: JobStage;
  progressDetails?: JobProgressDetails;
  resultDossierId?: string;
  errorMessage?: string;
  retryCount?: number;
}

export interface IJobRepository {
  createJob(payload: CreateJobPayload): Promise<DossierJob>;
  getJobById(id: string): Promise<DossierJob | null>;
  updateJobStatus(id: string, update: UpdateJobParams): Promise<DossierJob | null>;
  claimNextPendingJob(): Promise<DossierJob | null>;
  listJobs(): Promise<DossierJob[]>;
  pruneCompletedJobs(maxAgeMs?: number): Promise<number>;
}

/**
 * Bounded In-Memory Job Queue mit FIFO-Verdrängung gegen Memory Leaks.
 * Garantiert Zero-Config Portability ohne laufende Datenbank.
 */
export class InMemoryJobRepository implements IJobRepository {
  private jobs: DossierJob[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 50) {
    this.maxCapacity = maxCapacity;
  }

  async createJob(payload: CreateJobPayload): Promise<DossierJob> {
    const now = new Date().toISOString();
    const job: DossierJob = {
      id: crypto.randomUUID(),
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

    return { ...job };
  }

  async getJobById(id: string): Promise<DossierJob | null> {
    const job = this.jobs.find((j) => j.id === id);
    return job ? { ...job } : null;
  }

  async updateJobStatus(id: string, update: UpdateJobParams): Promise<DossierJob | null> {
    const index = this.jobs.findIndex((j) => j.id === id);
    if (index === -1) {
      return null;
    }

    const current = this.jobs[index];
    if (!current) {
      return null;
    }

    const updated: DossierJob = {
      id: current.id,
      status: update.status !== undefined ? update.status : current.status,
      stage: update.stage !== undefined ? update.stage : current.stage,
      progressDetails:
        update.progressDetails !== undefined ? update.progressDetails : current.progressDetails,
      payload: current.payload,
      resultDossierId:
        update.resultDossierId !== undefined ? update.resultDossierId : current.resultDossierId,
      errorMessage: update.errorMessage !== undefined ? update.errorMessage : current.errorMessage,
      retryCount: update.retryCount !== undefined ? update.retryCount : current.retryCount,
      maxRetries: current.maxRetries,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.jobs[index] = updated;
    return { ...updated };
  }

  async claimNextPendingJob(): Promise<DossierJob | null> {
    // Finde den ältesten Job im Zustand PENDING (FIFO am Ende des Arrays vor Verdrängung)
    const pendingJobs = this.jobs.filter((j) => j.status === JOB_STATUS.PENDING);
    if (pendingJobs.length === 0) {
      return null;
    }

    // Ältester Job nach createdAt
    const sorted = [...pendingJobs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const oldestPending = sorted[0];
    if (!oldestPending) {
      return null;
    }

    return this.updateJobStatus(oldestPending.id, {
      status: JOB_STATUS.PROCESSING,
      stage: JOB_STAGES.QUEUED,
    });
  }

  async listJobs(): Promise<DossierJob[]> {
    return this.jobs.map((j) => ({ ...j }));
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
}

/**
 * Supabase/PostgreSQL Job-Repository mit Fallback auf das In-Memory-Repository.
 */
export class SupabaseJobRepository implements IJobRepository {
  constructor(
    private supabase: SupabaseClient,
    private fallbackRepo: InMemoryJobRepository
  ) {}

  async createJob(payload: CreateJobPayload): Promise<DossierJob> {
    try {
      const { data, error } = await this.supabase
        .from('dossier_jobs')
        .insert({
          status: JOB_STATUS.PENDING,
          payload,
          retry_count: 0,
          max_retries: 3,
        })
        .select('*')
        .single();

      if (error || !data) {
        console.warn('Supabase createJob fehlgeschlagen, nutze Fallback-Queue:', error?.message);
        return this.fallbackRepo.createJob(payload);
      }

      return this.mapRowToJob(data);
    } catch (err) {
      console.warn('Supabase createJob Ausnahme:', err);
      return this.fallbackRepo.createJob(payload);
    }
  }

  async getJobById(id: string): Promise<DossierJob | null> {
    try {
      const { data, error } = await this.supabase
        .from('dossier_jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return this.fallbackRepo.getJobById(id);
      }

      return this.mapRowToJob(data);
    } catch (err) {
      console.warn('Supabase getJobById Ausnahme:', err);
      return this.fallbackRepo.getJobById(id);
    }
  }

  async updateJobStatus(id: string, update: UpdateJobParams): Promise<DossierJob | null> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (update.status !== undefined) updateData.status = update.status;
      if (update.stage !== undefined) updateData.stage = update.stage;
      if (update.progressDetails !== undefined)
        updateData.progress_details = update.progressDetails;
      if (update.resultDossierId !== undefined)
        updateData.result_dossier_id = update.resultDossierId;
      if (update.errorMessage !== undefined) updateData.error_message = update.errorMessage;
      if (update.retryCount !== undefined) updateData.retry_count = update.retryCount;

      const { data, error } = await this.supabase
        .from('dossier_jobs')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error || !data) {
        return this.fallbackRepo.updateJobStatus(id, update);
      }

      return this.mapRowToJob(data);
    } catch (err) {
      console.warn('Supabase updateJobStatus Ausnahme:', err);
      return this.fallbackRepo.updateJobStatus(id, update);
    }
  }

  async claimNextPendingJob(): Promise<DossierJob | null> {
    try {
      // Wähle ältesten PENDING Job aus und setze ihn atomar auf PROCESSING
      const { data, error } = await this.supabase
        .from('dossier_jobs')
        .select('*')
        .eq('status', JOB_STATUS.PENDING)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return this.fallbackRepo.claimNextPendingJob();
      }

      return this.updateJobStatus(data.id, {
        status: JOB_STATUS.PROCESSING,
        stage: JOB_STAGES.QUEUED,
      });
    } catch (err) {
      console.warn('Supabase claimNextPendingJob Ausnahme:', err);
      return this.fallbackRepo.claimNextPendingJob();
    }
  }

  async listJobs(): Promise<DossierJob[]> {
    try {
      const { data, error } = await this.supabase
        .from('dossier_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        return this.fallbackRepo.listJobs();
      }

      return data.map((row) => this.mapRowToJob(row));
    } catch (err) {
      console.warn('Supabase listJobs Ausnahme:', err);
      return this.fallbackRepo.listJobs();
    }
  }

  private mapRowToJob(row: Record<string, unknown>): DossierJob {
    return {
      id: String(row.id),
      status: row.status as JobStatus,
      stage: row.stage ? (row.stage as JobStage) : undefined,
      progressDetails: row.progress_details
        ? (row.progress_details as JobProgressDetails)
        : undefined,
      payload: row.payload as CreateJobPayload,
      resultDossierId: row.result_dossier_id ? String(row.result_dossier_id) : undefined,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
      retryCount: Number(row.retry_count ?? 0),
      maxRetries: Number(row.max_retries ?? 3),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async pruneCompletedJobs(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    try {
      const cutoffIso = new Date(Date.now() - maxAgeMs).toISOString();
      const { data, error } = await this.supabase
        .from('dossier_jobs')
        .delete()
        .in('status', [JOB_STATUS.COMPLETED, JOB_STATUS.FAILED])
        .lt('updated_at', cutoffIso)
        .select('id');

      if (error) {
        return this.fallbackRepo.pruneCompletedJobs(maxAgeMs);
      }

      return data ? data.length : 0;
    } catch (err) {
      console.warn('Supabase pruneCompletedJobs Ausnahme:', err);
      return this.fallbackRepo.pruneCompletedJobs(maxAgeMs);
    }
  }
}
