import { NextRequest, NextResponse } from 'next/server';
import { getTeamRepository } from '@/lib/supabase/server';
import { UpdateMemberRoleRequestSchema } from '@/types/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const orgId = req.headers.get('x-organization-id') || DEFAULT_ORG_ID;
    const body = await req.json();

    const parsed = UpdateMemberRoleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Rollen-Daten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const repo = getTeamRepository();
    const updated = await repo.updateMemberRole(id, parsed.data.role, orgId);

    if (!updated) {
      return NextResponse.json({ error: 'Mitglied nicht gefunden.' }, { status: 404 });
    }

    return NextResponse.json({ member: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fehler beim Ändern der Rolle.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const orgId = req.headers.get('x-organization-id') || DEFAULT_ORG_ID;
    const repo = getTeamRepository();

    const success = await repo.removeMember(id, orgId);
    if (!success) {
      return NextResponse.json({ error: 'Mitglied nicht gefunden.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fehler beim Entfernen des Mitglieds.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
