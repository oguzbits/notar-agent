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
  lockedAt?: string;
}

export interface IJobRepository {
  createJob(payload: CreateJobPayload, organizationId?: string): Promise<DossierJob>;
  getJobById(id: string, organizationId?: string): Promise<DossierJob | null>;
  updateJobStatus(id: string, update: UpdateJobParams): Promise<DossierJob | null>;
  claimNextPendingJob(organizationId?: string): Promise<DossierJob | null>;
  listJobs(organizationId?: string): Promise<DossierJob[]>;
  pruneCompletedJobs(maxAgeMs?: number): Promise<number>;
  recoverOrphanJobs(leaseTimeoutMs?: number, organizationId?: string): Promise<DossierJob[]>;
}

/**
 * Supabase/PostgreSQL Job-Repository (SSOT).
 * Strikte Fehlerbehandlung ohne stillen In-Memory Fallback.
 */
export class SupabaseJobRepository implements IJobRepository {
  constructor(private supabase: SupabaseClient) {}

  async createJob(payload: CreateJobPayload, organizationId?: string): Promise<DossierJob> {
    const insertData: Record<string, unknown> = {
      status: JOB_STATUS.PENDING,
      payload,
      retry_count: 0,
      max_retries: 3,
    };
    if (organizationId) {
      insertData.organization_id = organizationId;
    }

    const { data, error } = await this.supabase
      .from('dossier_jobs')
      .insert(insertData)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(
        `Supabase createJob fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    return this.mapRowToJob(data);
  }

  async getJobById(id: string, organizationId?: string): Promise<DossierJob | null> {
    let query = this.supabase.from('dossier_jobs').select('*').eq('id', id);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Supabase getJobById fehlgeschlagen: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.mapRowToJob(data);
  }

  async updateJobStatus(id: string, update: UpdateJobParams): Promise<DossierJob | null> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (update.status !== undefined) updateData.status = update.status;
    if (update.stage !== undefined) updateData.stage = update.stage;
    if (update.progressDetails !== undefined) updateData.progress_details = update.progressDetails;
    if (update.resultDossierId !== undefined) updateData.result_dossier_id = update.resultDossierId;
    if (update.errorMessage !== undefined) updateData.error_message = update.errorMessage;
    if (update.retryCount !== undefined) updateData.retry_count = update.retryCount;
    if (update.lockedAt !== undefined) updateData.locked_at = update.lockedAt;

    const { data, error } = await this.supabase
      .from('dossier_jobs')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(
        `Supabase updateJobStatus fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    return this.mapRowToJob(data);
  }

  async claimNextPendingJob(organizationId?: string): Promise<DossierJob | null> {
    let query = this.supabase.from('dossier_jobs').select('*').eq('status', JOB_STATUS.PENDING);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase claimNextPendingJob fehlgeschlagen: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.updateJobStatus(data.id, {
      status: JOB_STATUS.PROCESSING,
      stage: JOB_STAGES.QUEUED,
      lockedAt: new Date().toISOString(),
    });
  }

  async listJobs(organizationId?: string): Promise<DossierJob[]> {
    let query = this.supabase.from('dossier_jobs').select('*');

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) {
      throw new Error(
        `Supabase listJobs fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    return data.map((row) => this.mapRowToJob(row));
  }

  private mapRowToJob(row: Record<string, unknown>): DossierJob {
    return {
      id: String(row.id),
      organizationId: row.organization_id ? String(row.organization_id) : undefined,
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
      lockedAt: row.locked_at ? String(row.locked_at) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async pruneCompletedJobs(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffIso = new Date(Date.now() - maxAgeMs).toISOString();
    const { data, error } = await this.supabase
      .from('dossier_jobs')
      .delete()
      .in('status', [JOB_STATUS.COMPLETED, JOB_STATUS.FAILED])
      .lt('updated_at', cutoffIso)
      .select('id');

    if (error) {
      throw new Error(`Supabase pruneCompletedJobs fehlgeschlagen: ${error.message}`);
    }

    return data ? data.length : 0;
  }

  async recoverOrphanJobs(leaseTimeoutMs = 5 * 60 * 1000): Promise<DossierJob[]> {
    const cutoffIso = new Date(Date.now() - leaseTimeoutMs).toISOString();

    const { data: stuckJobs, error } = await this.supabase
      .from('dossier_jobs')
      .select('*')
      .eq('status', JOB_STATUS.PROCESSING)
      .or(`locked_at.lte.${cutoffIso},and(locked_at.is.null,updated_at.lte.${cutoffIso})`);

    if (error) {
      throw new Error(`Supabase recoverOrphanJobs fehlgeschlagen: ${error.message}`);
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      return [];
    }

    const recovered: DossierJob[] = [];
    for (const row of stuckJobs) {
      const job = this.mapRowToJob(row);
      const nextRetry = job.retryCount + 1;
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

    return recovered;
  }
}
