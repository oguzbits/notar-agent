import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { UPLOAD_URL_RATE_LIMIT } from '@/types/storage';

/** Uploads einer Kanzlei im Zeitfenster der Rate-Grenze; gezählt in PostgreSQL, Fehler brechen ab. */
export async function countRecentUploads(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('count_recent_uploads', {
    p_organization_id: organizationId,
    p_window: `${UPLOAD_URL_RATE_LIMIT.WINDOW_SECONDS} seconds`,
  });
  if (error) {
    throw new Error(`Supabase countRecentUploads fehlgeschlagen: ${error.message}`);
  }
  return data ?? 0;
}
