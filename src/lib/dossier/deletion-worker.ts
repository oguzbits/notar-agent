import { SupabaseClient } from '@supabase/supabase-js';
import { DB_TABLES, Database, TableRow, TableUpdate } from '@/types/database';
import { DELETION_TASK_STATUS } from '@/types/deletion';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';

export interface DeletionWorkerOptions {
  batchSize: number;
  maxAttempts: number;
}

export interface DeletionWorkerResult {
  done: number;
  failed: number;
  purged: number;
}

/**
 * Arbeitet die Outbox `deletion_tasks` ab. Doppelte Läufe sind unschädlich (Entfernen ist idempotent).
 * Ein bereits fehlendes Objekt gilt als erledigt; Fehler werden bis `maxAttempts` wiederholt.
 */
export async function processDeletionTasks(
  admin: SupabaseClient<Database>,
  { batchSize, maxAttempts }: DeletionWorkerOptions
): Promise<DeletionWorkerResult> {
  const { data: tasks, error } = await admin
    .from(DB_TABLES.DELETION_TASKS)
    .select('*')
    .eq('status', DELETION_TASK_STATUS.PENDING)
    .order('created_at')
    .limit(batchSize);
  if (error) throw new Error(`Löschaufgaben konnten nicht geladen werden: ${error.message}`);

  const result: DeletionWorkerResult = { done: 0, failed: 0, purged: 0 };
  const touchedDocuments = new Set<string>();

  for (const task of tasks ?? []) {
    touchedDocuments.add(task.document_id);
    const patch = await attemptRemoval(admin, task, maxAttempts);
    const { error: updateError } = await admin
      .from(DB_TABLES.DELETION_TASKS)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', task.id)
      .eq('status', DELETION_TASK_STATUS.PENDING);
    if (updateError) throw new Error(`Löschaufgabe nicht aktualisierbar: ${updateError.message}`);
    if (patch.status === DELETION_TASK_STATUS.DONE) result.done += 1;
    if (patch.status === DELETION_TASK_STATUS.FAILED) result.failed += 1;
  }

  for (const documentId of touchedDocuments) {
    const { data, error: purgeError } = await admin.rpc('complete_dossier_purge', {
      p_document_id: documentId,
    });
    if (purgeError) throw new Error(`Abschluss der Löschung fehlgeschlagen: ${purgeError.message}`);
    if (data) result.purged += 1;
  }
  return result;
}

type TaskRow = TableRow<typeof DB_TABLES.DELETION_TASKS>;
type TaskPatch = TableUpdate<typeof DB_TABLES.DELETION_TASKS>;

async function attemptRemoval(
  admin: SupabaseClient<Database>,
  task: TaskRow,
  maxAttempts: number
): Promise<TaskPatch> {
  // Zweite Sperre neben der Datenbank: nur Objekte der eigenen Kanzlei
  if (!task.storage_path.startsWith(`${task.organization_id}/`)) {
    return {
      status: DELETION_TASK_STATUS.FAILED,
      last_error: 'Pfad liegt außerhalb der Kanzlei',
      attempts: task.attempts + 1,
    };
  }
  const { error } = await admin.storage
    .from(STORAGE_BUCKET_NAMES.DOSSIER_FILES)
    .remove([task.storage_path]);
  if (!error) return { status: DELETION_TASK_STATUS.DONE, last_error: null };

  const attempts = task.attempts + 1;
  return attempts >= maxAttempts
    ? { status: DELETION_TASK_STATUS.FAILED, attempts, last_error: error.message }
    : { attempts, last_error: error.message };
}

export interface RetentionSweepResult {
  deleted: number;
  failed: { documentId: string; error: string }[];
}

/** Löscht fällige Dossiers (Fristen und Filter liegen in PostgreSQL); Fehler je Dossier werden gemeldet. */
export async function runRetentionSweep(
  admin: SupabaseClient<Database>,
  { limit }: { limit: number }
): Promise<RetentionSweepResult> {
  const { data: due, error } = await admin.rpc('list_retention_expired_dossiers', {
    p_limit: limit,
  });
  if (error) throw new Error(`Fällige Dossiers nicht ermittelbar: ${error.message}`);

  const result: RetentionSweepResult = { deleted: 0, failed: [] };
  for (const { id } of due ?? []) {
    const { error: deleteError } = await admin.rpc('delete_dossier_system', { p_document_id: id });
    if (deleteError) result.failed.push({ documentId: id, error: deleteError.message });
    else result.deleted += 1;
  }
  return result;
}
