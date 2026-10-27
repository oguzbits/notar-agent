import { NextRequest, NextResponse } from 'next/server';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { logFailure } from '@/lib/observability/logger';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { SsoLoginRequestSchema } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = SsoLoginRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültiger SSO-Anbieter oder Parameter.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { provider, redirectTo } = parsed.data;
    const supabase = await createServerAuthClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentifizierungsserver nicht verfügbar.' },
        { status: 503 }
      );
    }

    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.nextUrl.origin;
    const targetNext = safeRedirectPath(redirectTo);
    const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(targetNext)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error) {
      logFailure('warn', 'auth_sso_provider_1', error);
      return NextResponse.json(
        { error: 'Fehler beim Starten der SSO-Anmeldung.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      url: data.url,
    });
  } catch (err: unknown) {
    logFailure('error', 'auth_sso_fehlgeschlagen', err);
    return NextResponse.json({ error: 'Unerwarteter Fehler beim SSO-Login.' }, { status: 500 });
  }
}
