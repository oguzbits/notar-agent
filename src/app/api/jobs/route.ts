import { NextRequest, NextResponse } from 'next/server';
import { fromError } from 'zod-validation-error';
import { executeDossierJob } from '@/lib/jobs/job-worker';
import { getDossierRepository, getJobRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { JOB_STATUS, RetryJobRequestSchema } from '@/types/jobs';

export const dynamic = 'force-dynamic';

export async function GET(req?: NextRequest): Promise<Response> {
  try {
    const authSupabase = await createServerAuthClient();
    const queryOrgId = req
      ? req.headers.get('x-organization-id') ||
        req.nextUrl.searchParams.get('organizationId') ||
        undefined
      : undefined;
    const orgId = await resolveSessionOrganizationId(authSupabase, queryOrgId);
    const repo = getJobRepository(authSupabase);

    // Asynchrones Self-Healing im Hintergrund (blockiert den schnellen Read-Pfad der Tabelle nicht mit 2 Extra-DB-Roundtrips)
    void repo.recoverOrphanJobs(3 * 60 * 1000).catch((healErr) => {
      console.warn('[jobs GET] Self-healing fehlgeschlagen:', healErr);
    });

    const jobs = await repo.listJobs(orgId);
    return NextResponse.json({ jobs }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Laden der Jobs.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const rawBody: unknown = await req.json().catch(() => ({}));
    const parseResult = RetryJobRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const validationError = fromError(parseResult.error);
      return NextResponse.json({ error: validationError.toString() }, { status: 400 });
    }

    const { jobId } = parseResult.data;

    const authSupabase = await createServerAuthClient();
    const repo = getJobRepository(authSupabase);
    const job = await repo.getJobById(jobId);

    if (!job) {
      return NextResponse.json({ error: `Job mit ID '${jobId}' nicht gefunden.` }, { status: 404 });
    }

    // Reset job status to PENDING and clear previous error
    await repo.updateJobStatus(jobId, {
      status: JOB_STATUS.PENDING,
      errorMessage: undefined,
    });

    // Worker asynchron anstoßen mit authentifizierten Repositories
    void executeDossierJob(jobId, {
      jobRepo: repo,
      dossierRepo: getDossierRepository(authSupabase),
    });

    return NextResponse.json(
      {
        message: 'Job-Wiederholung erfolgreich eingereiht.',
        jobId,
        status: JOB_STATUS.PENDING,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler bei der Job-Wiederholung.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
