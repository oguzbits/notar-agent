import { NextRequest, NextResponse } from 'next/server';
import { getJobRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { JOB_STATUS } from '@/types/jobs';

export const dynamic = 'force-dynamic';

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
  if (!orgId) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      ),
    };
  }
  const repo = getJobRepository(authSupabase);
  let job = await repo.getJobById(id, orgId);

  if (!job) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: `Job mit ID '${id}' nicht gefunden.` },
        { status: 404 }
      ),
    };
  }

  // Zombie-/Stale-Job Erkennung: Falls ein PROCESSING- oder PENDING-Job seit > 3 Minuten keine Aktivität zeigte
  const leaseTimeoutMs = 3 * 60 * 1000;
  if (job.status === JOB_STATUS.PROCESSING || job.status === JOB_STATUS.PENDING) {
    const lastActiveIso = job.lockedAt || job.updatedAt || job.createdAt;
    const lastActiveMs = lastActiveIso ? new Date(lastActiveIso).getTime() : 0;
    const isStale = Date.now() - lastActiveMs > leaseTimeoutMs;

    if (isStale) {
      const updatedJob = await repo.updateJobStatus(id, {
        status: JOB_STATUS.FAILED,
        errorMessage: 'Verarbeitung unterbrochen. Bitte Vorgang erneut starten.',
        lockedAt: undefined,
      });
      if (updatedJob) {
        job = updatedJob;
      }
    }
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
