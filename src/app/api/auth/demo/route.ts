import { NextRequest, NextResponse } from 'next/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { demoUserCredentials } from '@/types/auth';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let redirectTo = '/';
    try {
      const body = await req.json();
      if (body?.redirectTo && typeof body.redirectTo === 'string') {
        redirectTo = body.redirectTo;
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

    // 1. Zuerst versuchen, eine isolierte anonyme Session zu starten (wie bei notebooklm-klon)
    let anonData = null;
    let anonError = null;
    if (typeof supabase.auth.signInAnonymously === 'function') {
      const anonResult = await supabase.auth.signInAnonymously({
        options: {
          data: {
            full_name: demoUserCredentials.FULL_NAME,
            title: demoUserCredentials.TITLE,
          },
        },
      });
      anonData = anonResult.data;
      anonError = anonResult.error;
    }

    if (!anonError && anonData?.user) {
      const userId = anonData.user.id;

      // Prüfen, ob der anonyme User bereits eine Organisation hat
      const { data: existingMember } = await supabase
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .select('organization_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingMember) {
        // Frische, isolierte Demo-Kanzlei für diese Session anlegen
        const { data: orgData, error: orgError } = await supabase
          .from(DB_TABLES.ORGANIZATIONS)
          .insert({
            name: demoUserCredentials.ORGANIZATION_NAME,
            official_seat: demoUserCredentials.OFFICIAL_SEAT,
            chamber_district: demoUserCredentials.CHAMBER_DISTRICT,
          })
          .select('*')
          .single();

        if (orgData && !orgError) {
          await supabase.from(DB_TABLES.ORGANIZATION_MEMBERS).insert({
            organization_id: orgData.id,
            user_id: userId,
            role: NOTARY_ROLES.NOTAR,
          });

          await supabase.from(DB_TABLES.PROFILES).upsert({
            id: userId,
            email: anonData.user.email || `${userId.slice(0, 8)}@demo.notariat.de`,
            full_name: demoUserCredentials.FULL_NAME,
            title: demoUserCredentials.TITLE,
          });
        }
      }

      return NextResponse.json({
        success: true,
        user: anonData.user,
        redirectTo,
      });
    }

    // 2. Fallback: Falls Anonymous Auth im Supabase Dashboard noch deaktiviert ist,
    // direkten Login mit den bestehenden Demo-Credentials versuchen
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: demoUserCredentials.EMAIL,
      password: demoUserCredentials.PASSWORD,
    });

    if (!signInError && signInData.user) {
      return NextResponse.json({
        success: true,
        user: signInData.user,
        redirectTo,
      });
    }

    // 2. Falls der Demo-Account noch nicht existiert: Automatisch anlegen (Auto-Provisioning)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: demoUserCredentials.EMAIL,
      password: demoUserCredentials.PASSWORD,
      options: {
        data: {
          full_name: demoUserCredentials.FULL_NAME,
          title: demoUserCredentials.TITLE,
        },
      },
    });

    if (signUpError || !signUpData.user) {
      return NextResponse.json(
        { error: signUpError?.message || 'Demo-Zugang konnte nicht angelegt werden.' },
        { status: 400 }
      );
    }

    const userId = signUpData.user.id;

    // 3. Demo-Kanzlei anlegen
    const { data: orgData, error: orgError } = await supabase
      .from(DB_TABLES.ORGANIZATIONS)
      .insert({
        name: demoUserCredentials.ORGANIZATION_NAME,
        official_seat: demoUserCredentials.OFFICIAL_SEAT,
        chamber_district: demoUserCredentials.CHAMBER_DISTRICT,
      })
      .select('*')
      .single();

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: orgError?.message || 'Demo-Kanzlei konnte nicht initialisiert werden.' },
        { status: 500 }
      );
    }

    // 4. Demo-Benutzer als Notar zuweisen
    const { error: memberError } = await supabase.from(DB_TABLES.ORGANIZATION_MEMBERS).insert({
      organization_id: orgData.id,
      user_id: userId,
      role: NOTARY_ROLES.NOTAR,
    });

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message || 'Zuweisung zur Demo-Kanzlei fehlgeschlagen.' },
        { status: 500 }
      );
    }

    // 5. Nach erfolgreicher Registrierung final einloggen (Session & Cookie etablieren)
    const { data: finalSignIn, error: finalError } = await supabase.auth.signInWithPassword({
      email: demoUserCredentials.EMAIL,
      password: demoUserCredentials.PASSWORD,
    });

    if (finalError || !finalSignIn.user) {
      return NextResponse.json(
        { error: finalError?.message || 'Anmeldung nach Demo-Initialisierung fehlgeschlagen.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: finalSignIn.user,
      redirectTo,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler beim Demo-Login.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
