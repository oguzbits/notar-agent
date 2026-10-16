import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { Database } from '@/types/database';

/** Service-Role-Client nur für Hintergrundläufe (Cron); nie in Nutzer-Requests verwenden. */
export function createServiceRoleClient(): SupabaseClient<Database> {
  const { NEXT_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
  if (!NEXT_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase-Service-Konfiguration (URL, Service-Role-Key) fehlt.');
  }
  return createClient<Database>(NEXT_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
