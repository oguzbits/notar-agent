import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requirePermission } from '@/lib/auth/require-permission';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import {
  CreateOrganizationRequestSchema,
  PERMISSION_ACTIONS,
  UpdateOrganizationRequestSchema,
} from '@/types/auth';
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

    const { data: orgData, error: orgError } = await supabase.rpc('create_new_organization', {
      org_name: name,
      org_seat: officialSeat,
      org_chamber: chamberDistrict,
    });

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: orgError?.message || 'Kanzlei konnte nicht erstellt werden.' },
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

    const { organizationId } = await requirePermission(supabase, PERMISSION_ACTIONS.MANAGE_TEAM, {
      requestedOrgId: req.headers.get('x-organization-id') ?? undefined,
      route: 'PUT /api/organization',
    });

    const body = await req.json().catch(() => ({}));
    const parsed = UpdateOrganizationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Kanzleidaten.', details: parsed.error.format() },
        { status: 400 }
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
      .eq('id', organizationId)
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
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : 'Fehler beim Aktualisieren der Kanzlei.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
