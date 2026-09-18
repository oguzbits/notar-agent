import { NextRequest, NextResponse } from 'next/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { RegisterRequestSchema } from '@/types/auth';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = RegisterRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Registrierungsdaten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password, fullName, title, organizationName, officialSeat, chamberDistrict } =
      parsed.data;
    const supabase = await createServerAuthClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentifizierungsserver nicht verfügbar.' },
        { status: 503 }
      );
    }

    // 1. Auth-Benutzer registrieren
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          title: title || '',
        },
      },
    });

    if (signUpError || !authData.user) {
      return NextResponse.json(
        { error: signUpError?.message || 'Registrierung fehlgeschlagen.' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // 2. Kanzlei-Organisation erstellen
    const { data: orgData, error: orgError } = await supabase
      .from(DB_TABLES.ORGANIZATIONS)
      .insert({
        name: organizationName,
        official_seat: officialSeat,
        chamber_district: chamberDistrict,
      })
      .select('*')
      .single();

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: orgError?.message || 'Kanzlei konnte nicht angelegt werden.' },
        { status: 500 }
      );
    }

    // 3. Benutzer als Notar/Inhaber zuweisen
    const { error: memberError } = await supabase.from(DB_TABLES.ORGANIZATION_MEMBERS).insert({
      organization_id: orgData.id,
      user_id: userId,
      role: NOTARY_ROLES.NOTAR,
    });

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message || 'Zuweisung zur Kanzlei fehlgeschlagen.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: userId,
          email,
          fullName,
          title,
        },
        organization: orgData,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler bei der Registrierung.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
