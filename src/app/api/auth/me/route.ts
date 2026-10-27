import { NextRequest, NextResponse } from 'next/server';
import { logFailure } from '@/lib/observability/logger';
import { createServerAuthClient, pickOrganization } from '@/lib/supabase/server-auth';
import { AuthSessionResponseSchema } from '@/types/auth';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES, NotaryRole } from '@/types/organization';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
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

    // Profil abrufen
    const { data: profile } = await supabase
      .from(DB_TABLES.PROFILES)
      .select('*')
      .eq('id', user.id)
      .single();

    // Alle Mitgliedschaften laden; die Kanzlei wählt die Auswahl-Logik wie bei den übrigen Routen.
    const { data: memberships, error: memberError } = await supabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('organization_id, role, organization:organizations(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true });
    if (memberError) {
      throw new Error(`Mitgliedschaft konnte nicht geladen werden: ${memberError.message}`);
    }

    const activeOrgId = pickOrganization(
      (memberships ?? []).map((m) => m.organization_id),
      req.headers.get('x-organization-id') ?? undefined
    );
    const member = (memberships ?? []).find((m) => m.organization_id === activeOrgId);

    // Ohne Kanzlei gilt die geringste Rolle (das Schema verlangt eine Rolle).
    const role: NotaryRole = (member?.role as NotaryRole) ?? NOTARY_ROLES.SACHBEARBEITER;
    const org = member?.organization as {
      id?: string;
      name?: string;
      official_seat?: string;
      chamber_district?: string;
    } | null;

    const hasActiveOrganization = Boolean(org?.id);

    const responsePayload = {
      user: {
        id: user.id,
        name:
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Benutzer',
        email: user.email || `${user.id.slice(0, 8)}@demo.notariat.de`,
        title: profile?.title || user.user_metadata?.title,
        role,
      },
      organization: hasActiveOrganization
        ? {
            id: org!.id!,
            name: org!.name || 'Kanzlei ohne Namen',
            officialSeat: org!.official_seat || '',
            chamberDistrict: org!.chamber_district || '',
          }
        : null,
      hasActiveOrganization,
    };

    const parsed = AuthSessionResponseSchema.safeParse(responsePayload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültiges Session-Datenformat.', details: parsed.error.format() },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (err: unknown) {
    logFailure('error', 'auth_me_fehlgeschlagen', err);
    return NextResponse.json({ error: 'Fehler beim Abrufen der Sitzungsdaten.' }, { status: 500 });
  }
}
