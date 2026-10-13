import { NextRequest, NextResponse } from 'next/server';
import { getJobRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';

type TargetJobResult =
  | { success: false; errorResponse: NextResponse<{ error: string }> }
  | {
      success: true;
      id: string;
      job: NonNullable<Awaited<ReturnType<ReturnType<typeof getJobRepository>['getJobById']>>>;
      repo: ReturnType<typeof getJobRepository>;
      orgId?: string;
    };

async function resolveTargetJob(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<TargetJobResult> {
  const { id } = await context.params;
  if (!id) {
    return {
      success: false,
      errorResponse: NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 }),
    };
  }

  const authSupabase = await createServerAuthClient();
  const tenantOrg =
    req.headers.get('x-organization-id') ??
    req.nextUrl.searchParams.get('organizationId') ??
    undefined;
  const orgId = await resolveSessionOrganizationId(authSupabase, tenantOrg);
  const repo = getJobRepository(authSupabase);
  const job = await repo.getJobById(id, orgId);

  if (!job) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: `Job mit ID '${id}' nicht gefunden.` },
        { status: 404 }
      ),
    };
  }

  return { success: true, id, job, repo, orgId };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const target = await resolveTargetJob(req, context);
  if (!target.success) return target.errorResponse;

  return NextResponse.json(target.job, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const target = await resolveTargetJob(req, context);
  if (!target.success) return target.errorResponse;

  await target.repo.deleteJob(target.id, target.orgId);

  return NextResponse.json(
    { success: true, message: 'Vorgang wurde erfolgreich gelöscht.' },
    { status: 200 }
  );
}
