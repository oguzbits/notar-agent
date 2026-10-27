import { NextRequest, NextResponse } from 'next/server';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { requirePermission } from '@/lib/auth/require-permission';
import { logFailure } from '@/lib/observability/logger';
import { getAuditRepository, getTeamRepository } from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { LastNotarError, TeamSelfChangeError } from '@/lib/team/team-repository';
import { changeMemberRole, removeMember, TeamServiceDeps } from '@/lib/team/team-service';
import { PERMISSION_ACTIONS, UpdateMemberRoleRequestSchema } from '@/types/auth';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ResolvedTeamRequest {
  id: string;
  deps: TeamServiceDeps;
}

/** Abgelehnte Teamänderung: eigene Mitgliedschaft 403, letzter NOTAR 409; sonst `undefined`. */
function teamChangeErrorResponse(err: unknown): NextResponse | undefined {
  if (err instanceof TeamSelfChangeError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof LastNotarError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  return undefined;
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
  const session = await requirePermission(authSupabase, PERMISSION_ACTIONS.MANAGE_TEAM, {
    requestedOrgId: queryOrgId,
    route: `${req.method} /api/team/[id]`,
  });
  const repo = getTeamRepository(authSupabase);
  return { id, deps: { repo, audit: getAuditRepository(authSupabase), session } };
}

export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id, deps } = await resolveTeamRequest(req, context);

    const body = await req.json();

    const parsed = UpdateMemberRoleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Rollen-Daten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await changeMemberRole(deps, id, parsed.data.role);

    if (!updated) {
      return NextResponse.json({ error: 'Mitglied nicht gefunden.' }, { status: 404 });
    }

    return NextResponse.json({ member: updated });
  } catch (err: unknown) {
    const denied = authzErrorResponse(err) ?? teamChangeErrorResponse(err);
    if (denied) return denied;
    logFailure('error', 'team_id_fehlgeschlagen', err);
    return NextResponse.json({ error: 'Fehler beim Ändern der Rolle.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { id, deps } = await resolveTeamRequest(req, context);

    const success = await removeMember(deps, id);
    if (!success) {
      return NextResponse.json({ error: 'Mitglied nicht gefunden.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const denied = authzErrorResponse(err) ?? teamChangeErrorResponse(err);
    if (denied) return denied;
    logFailure('error', 'team_id_fehlgeschlagen_2', err);
    return NextResponse.json({ error: 'Fehler beim Entfernen des Mitglieds.' }, { status: 500 });
  }
}
