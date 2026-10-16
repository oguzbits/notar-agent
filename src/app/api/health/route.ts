import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getEnv } from '@/env';
import { logFailure } from '@/lib/observability/logger';
import { DB_TABLES } from '@/types/database';

export const dynamic = 'force-dynamic';

function respond(ok: boolean): NextResponse {
  return NextResponse.json({ status: ok ? 'ok' : 'fehler' }, { status: ok ? 200 : 503 });
}

/** Öffentlicher Erreichbarkeitstest: anonymer Client, RLS-geschützte Abfrage; die Antwort enthält keine Details. */
export async function GET(): Promise<NextResponse> {
  try {
    const { NEXT_SUPABASE_URL, NEXT_SUPABASE_PUBLISHABLE_KEY } = getEnv();
    if (!NEXT_SUPABASE_URL || !NEXT_SUPABASE_PUBLISHABLE_KEY) return respond(false);
    const db = createClient(NEXT_SUPABASE_URL, NEXT_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await db.from(DB_TABLES.ORGANIZATIONS).select('id').limit(1);
    if (error) {
      logFailure('error', 'health_db_fehler', error);
      return respond(false);
    }
    return respond(true);
  } catch (err: unknown) {
    logFailure('error', 'health_ausnahme', err);
    return respond(false);
  }
}
