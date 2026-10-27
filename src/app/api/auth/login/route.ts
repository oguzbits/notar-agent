import { NextRequest, NextResponse } from 'next/server';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { logFailure } from '@/lib/observability/logger';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { LoginRequestSchema } from '@/types/auth';

export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

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
      return fail('Authentifizierungsserver nicht verfügbar.', 503);
    }

    if (password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logFailure('warn', 'auth_login_passwort_abgelehnt', error);
        return fail('Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Anmeldedaten.', 401);
      }

      return NextResponse.json({
        success: true,
        user: data.user,
      });
    } else {
      const origin = req.nextUrl.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeRedirectPath(redirectTo))}`,
        },
      });

      if (error) {
        logFailure('warn', 'auth_login_anmeldelink_fehlgeschlagen', error);
        return fail('Fehler beim Senden des Anmeldelinks.', 400);
      }

      return NextResponse.json({
        success: true,
        magicLinkSent: true,
        message: 'Ein Anmeldelink wurde an Ihre E-Mail-Adresse versendet.',
      });
    }
  } catch (err: unknown) {
    logFailure('error', 'auth_login_fehlgeschlagen', err);
    return NextResponse.json({ error: 'Unerwarteter Fehler bei der Anmeldung.' }, { status: 500 });
  }
}
