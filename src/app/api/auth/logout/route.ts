import { NextRequest, NextResponse } from 'next/server';
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
      return NextResponse.json(
        { error: error.message || 'Fehler beim Abmelden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Erfolgreich abgemeldet.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler bei der Abmeldung.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
