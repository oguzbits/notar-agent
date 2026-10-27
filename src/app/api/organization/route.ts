import { NextRequest, NextResponse } from 'next/server';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { requirePermission } from '@/lib/auth/require-permission';
import { logFailure } from '@/lib/observability/logger';
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
      logFailure('warn', 'organization_anlegen_abgelehnt', orgError);
      return NextResponse.json({ error: 'Kanzlei konnte nicht erstellt werden.' }, { status: 500 });
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
    logFailure('error', 'organization_anlegen_fehlgeschlagen', err);
    return NextResponse.json(
      { error: 'Unerwarteter Fehler beim Erstellen der Kanzlei.' },
      { status: 500 }
    );
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
      logFailure('warn', 'organization_aendern_abgelehnt', updateError);
      return NextResponse.json(
        { error: 'Kanzlei konnte nicht aktualisiert werden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
    });
  } catch (err: unknown) {
    const denied = authzErrorResponse(err);
    if (denied) return denied;
    logFailure('error', 'organization_aendern_fehlgeschlagen', err);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Kanzlei.' }, { status: 500 });
  }
}
