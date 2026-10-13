import { NextRequest, NextResponse } from 'next/server';
import { getTeamRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { InviteMemberRequestSchema } from '@/types/auth';

export const dynamic = 'force-dynamic';

type ValidatedTeamSession =
  | { errorResponse: NextResponse }
  | {
      authSupabase: Awaited<ReturnType<typeof createServerAuthClient>>;
      orgId: string;
      repo: ReturnType<typeof getTeamRepository>;
    };

async function getValidatedTeamSession(req: NextRequest): Promise<ValidatedTeamSession> {
  const authSupabase = await createServerAuthClient();
  const queryOrgId =
    req.headers.get('x-organization-id') ||
    req.nextUrl.searchParams.get('organizationId') ||
    undefined;
  const orgId = await resolveSessionOrganizationId(authSupabase, queryOrgId);

  if (!orgId) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      ),
    };
  }

  return { authSupabase, orgId, repo: getTeamRepository(authSupabase) };
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
    const session = await getValidatedTeamSession(req);
    if ('errorResponse' in session) return session.errorResponse;

    const body = await req.json();
    const parsed = InviteMemberRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültige Einladungsdaten.', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const member = await session.repo.inviteMember(parsed.data, session.orgId);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fehler beim Einladen des Kanzleimitglieds.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
