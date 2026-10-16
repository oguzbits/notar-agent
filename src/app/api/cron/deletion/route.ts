import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/env';
import {
  DELETION_WORKER_DEFAULTS,
  processDeletionTasks,
  runRetentionSweep,
} from '@/lib/dossier/deletion-worker';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Vercel-Cron ruft per GET mit `Authorization: Bearer ${CRON_SECRET}` auf. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  }
  try {
    const admin = createServiceRoleClient();
    const retention = await runRetentionSweep(admin, { limit: DELETION_WORKER_DEFAULTS.batchSize });
    const tasks = await processDeletionTasks(admin, DELETION_WORKER_DEFAULTS);
    return NextResponse.json({ tasks, retention });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Löschlauf fehlgeschlagen.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
