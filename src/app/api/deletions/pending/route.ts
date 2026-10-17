import { NextResponse } from 'next/server';
import { countPendingDeletionTasks } from '@/lib/dossier/pending-deletions';
import { logFailure } from '@/lib/observability/logger';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    const orgId = await resolveSessionOrganizationId(authSupabase);
    if (!authSupabase || !orgId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      );
    }
    return NextResponse.json({ pendingFiles: await countPendingDeletionTasks(authSupabase) });
  } catch (error: unknown) {
    logFailure('error', 'offene_loeschungen_laden_fehlgeschlagen', error);
    return NextResponse.json(
      { error: 'Offene Löschungen konnten nicht geladen werden.' },
      { status: 500 }
    );
  }
}
