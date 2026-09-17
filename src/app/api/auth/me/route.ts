import { NextRequest, NextResponse } from 'next/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { AuthSessionResponseSchema } from '@/types/auth';
import { NOTARY_ROLES, NotaryRole } from '@/types/organization';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest): Promise<NextResponse> {
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
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Kanzlei-Mitgliedschaft und Organisation abrufen
    const { data: member } = await supabase
      .from('organization_members')
      .select('role, organization:organizations(*)')
      .eq('user_id', user.id)
      .single();

    const role: NotaryRole = (member?.role as NotaryRole) || NOTARY_ROLES.NOTAR;
    const org = member?.organization as {
      id?: string;
      name?: string;
      official_seat?: string;
      chamber_district?: string;
    } | null;

    const responsePayload = {
      user: {
        id: user.id,
        name:
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Benutzer',
        email: user.email || '',
        title: profile?.title || user.user_metadata?.title,
        role,
      },
      organization: {
        id: org?.id || '550e8400-e29b-41d4-a716-446655440000',
        name: org?.name || 'Notariat Standard Kanzlei',
        officialSeat: org?.official_seat || 'Münster',
        chamberDistrict: org?.chamber_district || 'Westfälische Notarkammer',
      },
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
    const msg = err instanceof Error ? err.message : 'Fehler beim Abrufen der Sitzungsdaten.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
