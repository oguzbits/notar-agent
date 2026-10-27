import { NextRequest, NextResponse } from 'next/server';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { requirePermission } from '@/lib/auth/require-permission';
import { getAuditRepository, getTeamRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { inviteMember } from '@/lib/team/team-service';
import { InviteMemberRequestSchema, PERMISSION_ACTIONS } from '@/types/auth';

export const dynamic = 'force-dynamic';

type ValidatedTeamSession =
  { errorResponse: NextResponse } | { orgId: string; repo: ReturnType<typeof getTeamRepository> };

function requestedOrgId(req: NextRequest): string | undefined {
  return (
    req.headers.get('x-organization-id') ||
    req.nextUrl.searchParams.get('organizationId') ||
    undefined
  );
}

async function getValidatedTeamSession(req: NextRequest): Promise<ValidatedTeamSession> {
  const authSupabase = await createServerAuthClient();
  const orgId = await resolveSessionOrganizationId(authSupabase, requestedOrgId(req));

  if (!orgId) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      ),
    };
  }

  return { orgId, repo: getTeamRepository(authSupabase) };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getValidatedTeamSession(req);
    if ('errorResponse' in session) return session.errorResponse;

    const members = await session.repo.listMembers(session.orgId);
    return NextResponse.json({ members });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fehler beim Laden des Kanzleiteams.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    const session = await requirePermission(authSupabase, PERMISSION_ACTIONS.MANAGE_TEAM, {
      requestedOrgId: requestedOrgId(req),
      route: 'POST /api/team',
    });

    const body = await req.json();
    const parsed = InviteMemberRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Einladungsdaten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const repo = getTeamRepository(authSupabase);
    const audit = getAuditRepository(authSupabase);
    const member = await inviteMember({ repo, audit, session }, parsed.data);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err: unknown) {
    const denied = authzErrorResponse(err);
    if (denied) return denied;
    const msg = err instanceof Error ? err.message : 'Fehler beim Einladen des Kanzleimitglieds.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
