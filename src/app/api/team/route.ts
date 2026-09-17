import { NextRequest, NextResponse } from 'next/server';
import { getTeamRepository } from '@/lib/supabase/server';
import { InviteMemberRequestSchema } from '@/types/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const orgId = req.headers.get('x-organization-id') || DEFAULT_ORG_ID;
    const repo = getTeamRepository();
    const members = await repo.listMembers(orgId);
    return NextResponse.json({ members });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fehler beim Laden des Kanzleiteams.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const orgId = req.headers.get('x-organization-id') || DEFAULT_ORG_ID;
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
