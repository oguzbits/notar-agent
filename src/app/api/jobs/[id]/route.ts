import { NextRequest, NextResponse } from 'next/server';
import { getJobRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 });
  }

  const authSupabase = await createServerAuthClient();
  const queryOrgId =
    req.headers.get('x-organization-id') ||
    req.nextUrl.searchParams.get('organizationId') ||
    undefined;
  const orgId = await resolveSessionOrganizationId(authSupabase, queryOrgId);
  const repo = getJobRepository(authSupabase);
  const job = await repo.getJobById(id, orgId);

  if (!job) {
    return NextResponse.json({ error: `Job mit ID '${id}' nicht gefunden.` }, { status: 404 });
  }

  return NextResponse.json(job, { status: 200 });
}
