import { NextRequest, NextResponse } from 'next/server';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { logFailure } from '@/lib/observability/logger';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { demoUserCredentials } from '@/types/auth';
import { DB_TABLES } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let redirectTo = '/';
    try {
      const body = await req.json();
      if (body?.redirectTo && typeof body.redirectTo === 'string') {
        redirectTo = safeRedirectPath(body.redirectTo);
      }
    } catch (parseErr: unknown) {
      // Leerer oder nicht-JSON Body ist valide, Fallback auf '/'
      console.debug('[DemoAuth] Optionaler Request-Body nicht als JSON geparst:', parseErr);
    }

    const supabase = await createServerAuthClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentifizierungsserver nicht verfügbar.' },
        { status: 503 }
      );
    }

    // Isolierte anonyme Sitzung mit eigener Demo-Kanzlei je Browser
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          full_name: demoUserCredentials.FULL_NAME,
          title: demoUserCredentials.TITLE,
        },
      },
    });

    if (anonError || !anonData?.user) {
      logFailure('warn', 'auth_demo_provider_1', anonError);
      return NextResponse.json({ error: 'Demo-Zugang nicht verfügbar.' }, { status: 503 });
    }

    const userId = anonData.user.id;
    const { data: existingMember } = await supabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('organization_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingMember) {
      const { data: orgData, error: orgError } = await supabase.rpc('create_new_organization', {
        org_name: demoUserCredentials.ORGANIZATION_NAME,
        org_seat: demoUserCredentials.OFFICIAL_SEAT,
        org_chamber: demoUserCredentials.CHAMBER_DISTRICT,
      });

      if (orgError || !orgData) {
        logFailure('warn', 'auth_demo_provider_2', orgError);
        return NextResponse.json(
          { error: 'Demo-Kanzlei konnte nicht initialisiert werden.' },
          { status: 500 }
        );
      }

      await supabase.from(DB_TABLES.PROFILES).upsert({
        id: userId,
        email: anonData.user.email || `${userId.slice(0, 8)}@demo.notariat.de`,
        full_name: demoUserCredentials.FULL_NAME,
        title: demoUserCredentials.TITLE,
      });
    }

    return NextResponse.json({ success: true, user: anonData.user, redirectTo });
  } catch (err: unknown) {
    logFailure('error', 'auth_demo_fehlgeschlagen', err);
    return NextResponse.json({ error: 'Unerwarteter Fehler beim Demo-Login.' }, { status: 500 });
  }
}
