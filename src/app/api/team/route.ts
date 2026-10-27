import { NextRequest, NextResponse } from 'next/server';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { requirePermission } from '@/lib/auth/require-permission';
import { getTeamRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { PERMISSION_ACTIONS } from '@/types/auth';

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
    await requirePermission(authSupabase, PERMISSION_ACTIONS.MANAGE_TEAM, {
      requestedOrgId: requestedOrgId(req),
      route: 'POST /api/team',
    });
    // Ein echter Einladungsweg (Auth-Einladung per E-Mail) fehlt noch; keine Mitgliedschaft ohne echten Benutzer anlegen.
    return NextResponse.json(
      { error: 'Die Einladung von Mitarbeitenden ist noch nicht verfügbar.' },
      { status: 501 }
    );
  } catch (err: unknown) {
    const denied = authzErrorResponse(err);
    if (denied) return denied;
    const msg = err instanceof Error ? err.message : 'Fehler beim Einladen des Kanzleimitglieds.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
