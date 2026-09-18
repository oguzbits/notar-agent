import { NextRequest, NextResponse } from 'next/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { CreateOrganizationRequestSchema, UpdateOrganizationRequestSchema } from '@/types/auth';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerAuthClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentifizierungsserver nicht verfügbar.' },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateOrganizationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Kanzleidaten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, officialSeat, chamberDistrict } = parsed.data;

    // 1. Versuche die atomare RPC-Funktion (SECURITY DEFINER)
    const { data: rpcOrg, error: rpcError } = await supabase.rpc('create_new_organization', {
      org_name: name,
      org_seat: officialSeat,
      org_chamber: chamberDistrict,
    });

    if (!rpcError && rpcOrg) {
      return NextResponse.json(
        {
          success: true,
          organization: rpcOrg,
          role: NOTARY_ROLES.NOTAR,
        },
        { status: 201 }
      );
    }

    // 2. Fallback auf direkte Inserts (für Unit-Tests / lokales Mocking)
    const { data: orgData, error: orgError } = await supabase
      .from(DB_TABLES.ORGANIZATIONS)
      .insert({
        name,
        official_seat: officialSeat,
        chamber_district: chamberDistrict,
      })
      .select('*')
      .single();

    if (orgError || !orgData) {
      const errorMsg =
        rpcError?.message || orgError?.message || 'Kanzlei konnte nicht erstellt werden.';
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // Ersteller als Inhaber/Notar zuweisen
    const { error: memberError } = await supabase.from(DB_TABLES.ORGANIZATION_MEMBERS).insert({
      organization_id: orgData.id,
      user_id: user.id,
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
        organization: orgData,
        role: NOTARY_ROLES.NOTAR,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Unerwarteter Fehler beim Erstellen der Kanzlei.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerAuthClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentifizierungsserver nicht verfügbar.' },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = UpdateOrganizationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Kanzleidaten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Prüfe Kanzlei-Mitgliedschaft und Notar/Admin-Rolle des Benutzers
    const { data: member, error: memberError } = await supabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Sie sind keiner Kanzlei zugeordnet.' }, { status: 403 });
    }

    if (member.role !== NOTARY_ROLES.NOTAR && member.role !== NOTARY_ROLES.ADMIN) {
      return NextResponse.json(
        { error: 'Nur Notare oder Administratoren dürfen Kanzleidaten ändern.' },
        { status: 403 }
      );
    }

    const { name, officialSeat, chamberDistrict } = parsed.data;

    const { data: updatedOrg, error: updateError } = await supabase
      .from(DB_TABLES.ORGANIZATIONS)
      .update({
        name,
        official_seat: officialSeat,
        chamber_district: chamberDistrict,
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.organization_id)
      .select('*')
      .single();

    if (updateError || !updatedOrg) {
      return NextResponse.json(
        { error: updateError?.message || 'Kanzlei konnte nicht aktualisiert werden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Kanzlei.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
