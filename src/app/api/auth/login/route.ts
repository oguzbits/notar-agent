import { NextRequest, NextResponse } from 'next/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { LoginRequestSchema } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = LoginRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Anmeldedaten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password, redirectTo } = parsed.data;
    const supabase = await createServerAuthClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentifizierungsserver nicht verfügbar.' },
        { status: 503 }
      );
    }

    if (password) {
      // E-Mail + Passwort
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return NextResponse.json(
          {
            error: error.message || 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Anmeldedaten.',
          },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        user: data.user,
      });
    } else {
      // Magic Link
      const origin = req.nextUrl.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo || `${origin}/auth/callback`,
        },
      });

      if (error) {
        return NextResponse.json(
          { error: error.message || 'Fehler beim Senden des Anmeldelinks.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        magicLinkSent: true,
        message: 'Ein Anmeldelink wurde an Ihre E-Mail-Adresse versendet.',
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler bei der Anmeldung.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
