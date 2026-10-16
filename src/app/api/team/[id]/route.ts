import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requirePermission } from '@/lib/auth/require-permission';
import { getTeamRepository } from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { PERMISSION_ACTIONS, UpdateMemberRoleRequestSchema } from '@/types/auth';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ResolvedTeamRequest {
  id: string;
  orgId: string;
  repo: ReturnType<typeof getTeamRepository>;
}

async function resolveTeamRequest(
  req: NextRequest,
  context: RouteContext
): Promise<ResolvedTeamRequest> {
  const { id } = await context.params;
  const authSupabase = await createServerAuthClient();
  const queryOrgId =
    req.headers.get('x-organization-id') ||
    req.nextUrl.searchParams.get('organizationId') ||
    undefined;
  const { organizationId: orgId } = await requirePermission(
    authSupabase,
    PERMISSION_ACTIONS.MANAGE_TEAM,
    { requestedOrgId: queryOrgId, route: `${req.method} /api/team/[id]` }
  );

  return { id, orgId, repo: getTeamRepository(authSupabase) };
}

export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const resolved = await resolveTeamRequest(req, context);
    const { id, orgId, repo } = resolved;

    const body = await req.json();

    const parsed = UpdateMemberRoleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Rollen-Daten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await repo.updateMemberRole(id, parsed.data.role, orgId);

    if (!updated) {
      return NextResponse.json({ error: 'Mitglied nicht gefunden.' }, { status: 404 });
    }

    return NextResponse.json({ member: updated });
  } catch (err: unknown) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : 'Fehler beim Ändern der Rolle.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const resolved = await resolveTeamRequest(req, context);
    const { id, orgId, repo } = resolved;

    const success = await repo.removeMember(id, orgId);
    if (!success) {
      return NextResponse.json({ error: 'Mitglied nicht gefunden.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : 'Fehler beim Entfernen des Mitglieds.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
