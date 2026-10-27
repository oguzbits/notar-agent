import { NextRequest, NextResponse } from 'next/server';
import { logFailure } from '@/lib/observability/logger';
import { createServerAuthClient } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerAuthClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentifizierungsserver nicht verfügbar.' },
        { status: 503 }
      );
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      logFailure('warn', 'auth_logout_provider_1', error);
      return NextResponse.json({ error: 'Fehler beim Abmelden.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Erfolgreich abgemeldet.',
    });
  } catch (err: unknown) {
    logFailure('error', 'auth_logout_fehlgeschlagen', err);
    return NextResponse.json({ error: 'Unerwarteter Fehler bei der Abmeldung.' }, { status: 500 });
  }
}
