import { NextRequest, NextResponse } from 'next/server';
import { fromError } from 'zod-validation-error';
import { executeDossierJob } from '@/lib/jobs/job-worker';
import { getJobRepository } from '@/lib/supabase/server';
import { JOB_STATUS, RetryJobRequestSchema } from '@/types/jobs';

export const dynamic = 'force-dynamic';

export async function GET(req?: NextRequest): Promise<Response> {
  try {
    const orgId = req
      ? req.headers.get('x-organization-id') ||
        req.nextUrl.searchParams.get('organizationId') ||
        undefined
      : undefined;
    const repo = getJobRepository();
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

    const repo = getJobRepository();
    const job = await repo.getJobById(jobId);

    if (!job) {
      return NextResponse.json({ error: `Job mit ID '${jobId}' nicht gefunden.` }, { status: 404 });
    }

    // Reset job status to PENDING and clear previous error
    await repo.updateJobStatus(jobId, {
      status: JOB_STATUS.PENDING,
      errorMessage: undefined,
    });

    // Worker asynchron anstoßen
    void executeDossierJob(jobId);

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
