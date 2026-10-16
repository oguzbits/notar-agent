import { NextRequest, NextResponse, after } from 'next/server';
import { fromError } from 'zod-validation-error';
import type { IJobRepository } from '@/lib/jobs/job-repository';
import { executeDossierJob, type WorkerDependencies } from '@/lib/jobs/job-worker';
import { getDossierRepository, getJobRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { JOB_STATUS, RetryJobRequestSchema, type DossierJob } from '@/types/jobs';

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
    if (!orgId)
      return NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      );
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

async function requeueFailedJob(
  repo: IJobRepository,
  job: DossierJob,
  orgId: string
): Promise<Response | null> {
  if (job.status !== JOB_STATUS.FAILED || job.retryCount >= job.maxRetries) {
    return NextResponse.json(
      { error: 'Dieser Vorgang kann nicht erneut gestartet werden.' },
      { status: 409 }
    );
  }
  // Atomar nur aus FAILED einreihen: parallele Wiederholungen starten den Job nicht doppelt
  const requeued = await repo.transitionJob(
    job.id,
    [JOB_STATUS.FAILED],
    { status: JOB_STATUS.PENDING, retryCount: job.retryCount + 1, errorMessage: undefined },
    orgId
  );
  if (requeued) return null;
  return NextResponse.json(
    { error: 'Dieser Vorgang wurde bereits erneut gestartet.' },
    { status: 409 }
  );
}

function startRetryInBackground(jobId: string, deps: WorkerDependencies): void {
  try {
    after(async () => {
      await executeDossierJob(jobId, deps);
    });
  } catch (afterErr: unknown) {
    console.debug('[jobs] after() nicht verfügbar, nutze direkten Aufruf:', afterErr);
    void executeDossierJob(jobId, deps);
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
    const orgId = await resolveSessionOrganizationId(
      authSupabase,
      req.headers.get('x-organization-id') ?? undefined
    );
    if (!orgId)
      return NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      );
    const repo = getJobRepository(authSupabase);
    const job = await repo.getJobById(jobId, orgId);

    if (!job) {
      return NextResponse.json({ error: `Job mit ID '${jobId}' nicht gefunden.` }, { status: 404 });
    }

    const rejection = await requeueFailedJob(repo, job, orgId);
    if (rejection) return rejection;

    startRetryInBackground(jobId, {
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
