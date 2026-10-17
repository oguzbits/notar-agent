import { SupabaseClient } from '@supabase/supabase-js';
import { DB_TABLES, Database } from '@/types/database';
import { DELETION_TASK_STATUS } from '@/types/deletion';

/** Offene Storage-Löschaufgaben der Kanzlei der Sitzung (RLS begrenzt auf die eigene Kanzlei). */
export async function countPendingDeletionTasks(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { count, error } = await supabase
    .from(DB_TABLES.DELETION_TASKS)
    .select('id', { count: 'exact', head: true })
    .eq('status', DELETION_TASK_STATUS.PENDING);
  if (error) throw new Error(`Supabase countPendingDeletionTasks fehlgeschlagen: ${error.message}`);
  return count ?? 0;
}
