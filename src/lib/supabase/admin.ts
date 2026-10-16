import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { Database } from '@/types/database';

/**
 * Service-Role-Client nur für Hintergrundläufe (Cron). Einzige Ausnahme in Nutzer-Requests: der Löschnachlauf
 * in `DELETE /api/documents`, erst nach der Rechteprüfung und begrenzt auf die Aufgaben einer Akte.
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  const { NEXT_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
  if (!NEXT_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase-Service-Konfiguration (URL, Service-Role-Key) fehlt.');
  }
  return createClient<Database>(NEXT_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
