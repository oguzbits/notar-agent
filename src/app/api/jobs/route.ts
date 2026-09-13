import { NextRequest, NextResponse } from 'next/server';
import { executeDossierJob } from '@/lib/jobs/job-worker';
import { getJobRepository } from '@/lib/supabase/server';
import { JOB_STATUS } from '@/types/jobs';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const repo = getJobRepository();
    const jobs = await repo.listJobs();
    return NextResponse.json({ jobs }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Laden der Jobs.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body: unknown = await req.json().catch(() => ({}));
    const { jobId } = (body || {}) as { jobId?: string };

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json(
        { error: 'Parameter "jobId" fehlt oder ist ungültig.' },
        { status: 400 }
      );
    }

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
