import { NextRequest, NextResponse } from 'next/server';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
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
      return NextResponse.json(
        { error: anonError?.message || 'Demo-Zugang nicht verfügbar.' },
        { status: 503 }
      );
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
        return NextResponse.json(
          { error: orgError?.message || 'Demo-Kanzlei konnte nicht initialisiert werden.' },
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
    const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler beim Demo-Login.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
