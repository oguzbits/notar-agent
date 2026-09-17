import { NextRequest, NextResponse } from 'next/server';
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

    const origin = req.nextUrl.origin;
    const targetNext = redirectTo || '/';
    const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(targetNext)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Fehler beim Starten der SSO-Anmeldung.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      url: data.url,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler beim SSO-Login.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
