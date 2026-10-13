import { SupabaseClient } from '@supabase/supabase-js';
import {
  applyOrganizationFilter,
  executeMaybeSingle,
  executeList,
} from '@/lib/supabase/db-query-helpers';
import { DB_TABLES, Database, TableInsert, TableUpdate } from '@/types/database';
import {
  CreateJobPayload,
  DossierJob,
  JobProgressDetails,
  JOB_STATUS,
  JOB_STAGES,
  JobStatus,
  JobStage,
} from '@/types/jobs';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';

export interface UpdateJobParams {
  status?: JobStatus;
  stage?: JobStage;
  progressDetails?: JobProgressDetails;
  payload?: CreateJobPayload;
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
  deleteJob(id: string, organizationId?: string): Promise<boolean>;
  pruneCompletedJobs(maxAgeMs?: number): Promise<number>;
  recoverOrphanJobs(leaseTimeoutMs?: number, organizationId?: string): Promise<DossierJob[]>;
}

/**
 * Supabase/PostgreSQL Job-Repository (SSOT).
 * Strikte Fehlerbehandlung (Fail-Fast).
 */
export class SupabaseJobRepository implements IJobRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async createJob(payload: CreateJobPayload, organizationId?: string): Promise<DossierJob> {
    const insertData: TableInsert<typeof DB_TABLES.DOSSIER_JOBS> = {
      id: crypto.randomUUID(),
      status: JOB_STATUS.PENDING,
      payload,
      retry_count: 0,
      max_retries: 3,
      organization_id: organizationId ?? null,
    };

    const { data, error } = await this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
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
    const query = applyOrganizationFilter(
      this.supabase.from(DB_TABLES.DOSSIER_JOBS).select('*').eq('id', id),
      organizationId
    );

    const data = await executeMaybeSingle(query.maybeSingle(), 'getJobById');
    if (!data) {
      return null;
    }

    return this.mapRowToJob(data);
  }

  async updateJobStatus(id: string, update: UpdateJobParams): Promise<DossierJob | null> {
    const updateData: TableUpdate<typeof DB_TABLES.DOSSIER_JOBS> = {
      updated_at: new Date().toISOString(),
    };

    const fieldMap: Record<
      keyof UpdateJobParams,
      keyof TableUpdate<typeof DB_TABLES.DOSSIER_JOBS>
    > = {
      status: 'status',
      stage: 'stage',
      progressDetails: 'progress_details',
      payload: 'payload',
      resultDossierId: 'result_dossier_id',
      errorMessage: 'error_message',
      retryCount: 'retry_count',
      lockedAt: 'locked_at',
    };

    for (const [key, dbCol] of Object.entries(fieldMap) as [
      keyof UpdateJobParams,
      keyof TableUpdate<typeof DB_TABLES.DOSSIER_JOBS>,
    ][]) {
      if (update[key] !== undefined) {
        (updateData as Record<string, unknown>)[dbCol] = update[key];
      }
    }

    const { data, error } = await this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
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
    let query = this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
      .select('*')
      .eq('status', JOB_STATUS.PENDING);

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
    const query = applyOrganizationFilter(
      this.supabase.from(DB_TABLES.DOSSIER_JOBS).select('*'),
      organizationId
    );

    const data = await executeList(query.order('created_at', { ascending: false }), 'listJobs');

    return data.map((row) => this.mapRowToJob(row, { lightweight: true }));
  }

  private mapRowToJob(
    row: Record<string, unknown>,
    options?: { lightweight?: boolean }
  ): DossierJob {
    const rawPayload = row.payload as CreateJobPayload | undefined;
    const sanitizedPayload: CreateJobPayload =
      options?.lightweight && rawPayload
        ? {
            ...rawPayload,
            files: (rawPayload.files || []).map(({ name, size, type, isBase64 }) => ({
              name,
              size,
              type,
              isBase64,
            })),
          }
        : (rawPayload as CreateJobPayload);

    return {
      id: String(row.id),
      organizationId: row.organization_id ? String(row.organization_id) : undefined,
      status: row.status as JobStatus,
      stage: row.stage ? (row.stage as JobStage) : undefined,
      progressDetails: row.progress_details
        ? (row.progress_details as JobProgressDetails)
        : undefined,
      payload: sanitizedPayload,
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
      .from(DB_TABLES.DOSSIER_JOBS)
      .delete()
      .in('status', [JOB_STATUS.COMPLETED, JOB_STATUS.FAILED])
      .lt('updated_at', cutoffIso)
      .select('id');

    if (error) {
      throw new Error(`Supabase pruneCompletedJobs fehlgeschlagen: ${error.message}`);
    }

    return data ? data.length : 0;
  }

  async deleteJob(id: string, organizationId?: string): Promise<boolean> {
    try {
      const job = await this.getJobById(id, organizationId);
      if (job) {
        const files = job.payload?.files ?? [];
        const storagePaths = files
          .map((f) => f.storagePath)
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);

        if (storagePaths.length > 0 && this.supabase.storage) {
          await this.supabase.storage.from(STORAGE_BUCKET_NAMES.DOSSIER_FILES).remove(storagePaths);
        }
      }
    } catch (storageErr) {
      console.warn(
        '[deleteJob] Warnung beim Bereinigen von Storage-Dateien für Job:',
        id,
        storageErr
      );
    }

    let query = this.supabase.from(DB_TABLES.DOSSIER_JOBS).delete().eq('id', id);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Supabase deleteJob fehlgeschlagen: ${error.message}`);
    }

    return true;
  }

  async recoverOrphanJobs(leaseTimeoutMs = 3 * 60 * 1000): Promise<DossierJob[]> {
    const cutoffIso = new Date(Date.now() - leaseTimeoutMs).toISOString();

    // 1. Suche nach hängengebliebenen PROCESSING-Jobs (Lease abgelaufen)
    const { data: stuckProcessingJobs, error: procError } = await this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
      .select('*')
      .eq('status', JOB_STATUS.PROCESSING)
      .or(`locked_at.lte.${cutoffIso},and(locked_at.is.null,updated_at.lte.${cutoffIso})`);

    if (procError) {
      throw new Error(
        `Supabase recoverOrphanJobs (PROCESSING) fehlgeschlagen: ${procError.message}`
      );
    }

    // 2. Suche nach verwaisten PENDING-Jobs, die seit Ablauf des Timeouts nie übernommen wurden
    const { data: stuckPendingJobs, error: pendError } = await this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
      .select('*')
      .eq('status', JOB_STATUS.PENDING)
      .lte('created_at', cutoffIso);

    if (pendError) {
      throw new Error(`Supabase recoverOrphanJobs (PENDING) fehlgeschlagen: ${pendError.message}`);
    }

    const recovered: DossierJob[] = [];

    // Verwaiste PROCESSING-Jobs behandeln (Automatischer Abbruch mit klarer Notar-Fehlermeldung)
    for (const row of stuckProcessingJobs ?? []) {
      const job = this.mapRowToJob(row);
      const nextRetry = job.retryCount + 1;

      const updated = await this.updateJobStatus(job.id, {
        status: JOB_STATUS.FAILED,
        errorMessage: 'Verarbeitung unterbrochen. Bitte Vorgang erneut starten.',
        retryCount: nextRetry,
        lockedAt: undefined,
      });

      if (updated) {
        recovered.push(updated);
      }
    }

    // Verwaiste PENDING-Jobs behandeln (Automatisch FAILED mit verständlicher Notar-Fehlermeldung)
    for (const row of stuckPendingJobs ?? []) {
      const job = this.mapRowToJob(row);
      const updated = await this.updateJobStatus(job.id, {
        status: JOB_STATUS.FAILED,
        errorMessage: 'Verarbeitung unterbrochen. Bitte Vorgang erneut starten.',
        retryCount: job.retryCount + 1,
      });

      if (updated) {
        recovered.push(updated);
      }
    }

    return recovered;
  }
}
