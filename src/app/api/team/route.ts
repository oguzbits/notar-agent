import { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getTeamRepository } from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { InviteMemberRequestSchema } from '@/types/auth';
import { DB_TABLES } from '@/types/database';

export const dynamic = 'force-dynamic';

const DEFAULT_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';

async function resolveOrganizationId(
  req: NextRequest,
  supabase: SupabaseClient | null
): Promise<string> {
  const headerOrgId = req.headers.get('x-organization-id');
  if (headerOrgId) return headerOrgId;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: member } = await supabase
        .from(DB_TABLES.ORGANIZATION_MEMBERS)
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (member?.organization_id) {
        return member.organization_id;
      }
    }
  }

  return DEFAULT_ORG_ID;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    const orgId = await resolveOrganizationId(req, authSupabase);
    const repo = getTeamRepository(authSupabase);
    const members = await repo.listMembers(orgId);
    return NextResponse.json({ members });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fehler beim Laden des Kanzleiteams.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    const orgId = await resolveOrganizationId(req, authSupabase);
    const body = await req.json();
    const parsed = InviteMemberRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Einladungsdaten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const repo = getTeamRepository();
    const member = await repo.inviteMember(parsed.data, orgId);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fehler beim Einladen des Kanzleimitglieds.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
