import { SupabaseClient } from '@supabase/supabase-js';
import { logFailure } from '@/lib/observability/logger';
import { isOwnUploadPath } from '@/lib/storage/storage-path';
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
  JOB_MAX_RETRIES,
  JOB_STATUS,
  JobStatus,
  JobStage,
  UpdateJobParams,
} from '@/types/jobs';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';

/** Aufbewahrung beendeter Vorgänge samt Dateien (Mandantendaten), danach löscht der Cron. */
export const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const JOB_PRUNE_BATCH = 100;

/** Höchstzahl der Vorgänge je Abruf der Übersicht (neueste zuerst). */
export const JOB_LIST_LIMIT = 100;

// Übersicht ohne Zwischenergebnisse und Dateiinhalte: nur die angezeigten Payload-Felder (JSON-Pfad)
const JOB_LIST_COLUMNS =
  'id, organization_id, status, stage, progress_details, result_dossier_id, error_message, retry_count, max_retries, locked_at, created_at, updated_at, caseType:payload->caseType, notes:payload->notes, files:payload->files';

function toListRow(row: Record<string, unknown>): Record<string, unknown> {
  const { caseType, notes, files, ...rest } = row;
  return { ...rest, payload: { caseType, notes, files } };
}

/** Zusatzbedingungen eines Übergangs; jede gesetzte Bedingung muss zutreffen. */
export interface JobTransitionGuard {
  organizationId?: string;
  /** Lauf-Kennung: nur der Lauf, der den Job mit dieser Sperrzeit übernommen hat, darf ändern. */
  lockedAt?: string;
  /** Nicht in dieser Stufe (Jobs ohne Stufe zählen als zutreffend). */
  stageNot?: JobStage;
}

export interface IJobRepository {
  createJob(payload: CreateJobPayload, organizationId?: string): Promise<DossierJob>;
  getJobById(id: string, organizationId?: string): Promise<DossierJob | null>;
  updateJobStatus(id: string, update: UpdateJobParams): Promise<DossierJob | null>;
  /**
   * Atomarer Compare-and-set: ändert den Job nur, wenn er sich noch in einem der Ausgangsstatus
   * befindet (eine einzige SQL-Anweisung). `null`, wenn ein anderer Aufrufer zuvor gewonnen hat.
   */
  transitionJob(
    id: string,
    fromStatuses: JobStatus[],
    update: UpdateJobParams,
    guard?: JobTransitionGuard
  ): Promise<DossierJob | null>;
  listJobs(organizationId?: string): Promise<DossierJob[]>;
  countJobsSince(organizationId: string, sinceIso: string): Promise<number>;
  deleteJob(id: string, organizationId?: string): Promise<boolean>;
  pruneCompletedJobs(maxAgeMs?: number): Promise<number>;
  /** Setzt PENDING/PROCESSING-Jobs ohne Lebenszeichen (`updated_at`) auf FAILED; liefert die Anzahl. */
  recoverOrphanJobs(leaseTimeoutMs?: number, organizationId?: string): Promise<number>;
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
      max_retries: JOB_MAX_RETRIES,
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
    const updateData = this.buildUpdateData(update);
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

  async transitionJob(
    id: string,
    fromStatuses: JobStatus[],
    update: UpdateJobParams,
    guard: JobTransitionGuard = {}
  ): Promise<DossierJob | null> {
    let query = this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
      .update(this.buildUpdateData(update))
      .eq('id', id)
      .in('status', fromStatuses);
    if (guard.organizationId) {
      query = query.eq('organization_id', guard.organizationId);
    }
    if (guard.lockedAt) {
      query = query.eq('locked_at', guard.lockedAt);
    }
    if (guard.stageNot) {
      query = query.or(`stage.is.null,stage.neq.${guard.stageNot}`);
    }

    const { data, error } = await query.select('*');
    if (error) {
      throw new Error(`Supabase transitionJob fehlgeschlagen: ${error.message}`);
    }
    const row = data?.[0];
    return row ? this.mapRowToJob(row) : null;
  }

  private buildUpdateData(update: UpdateJobParams): TableUpdate<typeof DB_TABLES.DOSSIER_JOBS> {
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

    return updateData;
  }

  async listJobs(organizationId?: string): Promise<DossierJob[]> {
    const query = applyOrganizationFilter(
      this.supabase.from(DB_TABLES.DOSSIER_JOBS).select(JOB_LIST_COLUMNS),
      organizationId
    );

    const data = await executeList(
      query.order('created_at', { ascending: false }).limit(JOB_LIST_LIMIT),
      'listJobs'
    );

    return data.map((row) => this.mapRowToJob(toListRow(row), { lightweight: true }));
  }

  async countJobsSince(organizationId: string, sinceIso: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', sinceIso);
    if (error) {
      throw new Error(`Supabase countJobsSince fehlgeschlagen: ${error.message}`);
    }
    return count ?? 0;
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

  /**
   * Entfernt Dateien im Speicher; ein Fehler bricht ab, bevor die Zeile gelöscht wird.
   * Pfade sind Client-Eingaben und der Cron löscht mit Service-Rolle: nur eigene Upload-Pfade.
   */
  private async removeStorageFiles(
    files: { storagePath?: string }[],
    organizationId?: string | null
  ): Promise<void> {
    const all = files.flatMap((f) => (f.storagePath?.trim() ? [f.storagePath] : []));
    const paths = all.filter((p) => organizationId && isOwnUploadPath(p, organizationId));
    if (paths.length < all.length) {
      const msg = `${all.length - paths.length} Pfade übersprungen`;
      logFailure('warn', 'job_fremde_pfade_uebersprungen', new Error(msg));
    }
    if (paths.length === 0) return;
    const bucket = this.supabase.storage.from(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
    const { error } = await bucket.remove(paths);
    if (error) throw new Error(`Supabase Storage remove fehlgeschlagen: ${error.message}`);
  }

  async pruneCompletedJobs(maxAgeMs = JOB_RETENTION_MS): Promise<number> {
    const cutoffIso = new Date(Date.now() - maxAgeMs).toISOString();
    // Nur Endzustände; ein fehlgeschlagener Vorgang ist nach der Frist nicht mehr wiederholbar (Quelldateien weg)
    const isPrunable = `status.in.(${JOB_STATUS.COMPLETED},${JOB_STATUS.CANCELLED},${JOB_STATUS.FAILED})`;
    const candidates = await executeList(
      this.supabase
        .from(DB_TABLES.DOSSIER_JOBS)
        .select('id, organization_id, files:payload->files')
        .or(isPrunable)
        .lt('updated_at', cutoffIso)
        .order('updated_at', { ascending: true })
        .limit(JOB_PRUNE_BATCH),
      'pruneCompletedJobs'
    );
    if (candidates.length === 0) return 0;

    // Ein defekter Job darf den Lauf nicht blockieren: Zeile bleibt, übrige werden gelöscht
    const deletable: string[] = [];
    for (const c of candidates) {
      try {
        await this.removeStorageFiles(Array.isArray(c.files) ? c.files : [], c.organization_id);
        deletable.push(c.id);
      } catch (err) {
        logFailure('warn', 'job_aufbewahrung_dateien_fehlgeschlagen', err);
      }
    }
    if (deletable.length === 0) return 0;

    const { data, error } = await this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
      .delete()
      .in('id', deletable)
      .or(isPrunable)
      .lt('updated_at', cutoffIso)
      .select('id');
    if (error) {
      throw new Error(`Supabase pruneCompletedJobs fehlgeschlagen: ${error.message}`);
    }
    return data?.length ?? 0;
  }

  async deleteJob(id: string, organizationId?: string): Promise<boolean> {
    const job = await this.getJobById(id, organizationId);
    if (job) await this.removeStorageFiles(job.payload?.files ?? [], job.organizationId);

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

  async recoverOrphanJobs(
    leaseTimeoutMs = 3 * 60 * 1000,
    organizationId?: string
  ): Promise<number> {
    const cutoffIso = new Date(Date.now() - leaseTimeoutMs).toISOString();

    // Ein bedingtes Update: Jedes Fortschritts-Update erneuert updated_at, also gilt nur ein stiller Job als veraltet
    let query = this.supabase
      .from(DB_TABLES.DOSSIER_JOBS)
      .update(
        this.buildUpdateData({
          status: JOB_STATUS.FAILED,
          errorMessage: 'Verarbeitung unterbrochen. Bitte Vorgang erneut starten.',
          lockedAt: null,
        })
      )
      .in('status', [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING])
      .lt('updated_at', cutoffIso);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.select('id');
    if (error) {
      throw new Error(`Supabase recoverOrphanJobs fehlgeschlagen: ${error.message}`);
    }
    return data?.length ?? 0;
  }
}
