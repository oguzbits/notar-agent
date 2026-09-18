import { NextRequest, NextResponse } from 'next/server';
import { cancelDossierJob } from '@/lib/jobs/job-worker';
import { getJobRepository } from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { JOB_STATUS } from '@/types/jobs';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 });
    }

    const orgId =
      req.headers.get('x-organization-id') ||
      req.nextUrl.searchParams.get('organizationId') ||
      undefined;

    const authSupabase = await createServerAuthClient();
    const repo = getJobRepository(authSupabase);
    const job = await repo.getJobById(id, orgId);

    if (!job) {
      return NextResponse.json({ error: `Job mit ID '${id}' nicht gefunden.` }, { status: 404 });
    }

    if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) {
      return NextResponse.json(
        {
          error: `Job kann nicht mehr abgebrochen werden, da er bereits den Status '${job.status}' besitzt.`,
        },
        { status: 400 }
      );
    }

    if (job.status === JOB_STATUS.CANCELLED) {
      return NextResponse.json({ message: 'Job wurde bereits abgebrochen.', job }, { status: 200 });
    }

    const cancelledJob = await cancelDossierJob(id, { jobRepo: repo });

    return NextResponse.json(
      {
        message: 'Vorgang wurde erfolgreich abgebrochen.',
        job: cancelledJob,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Abbrechen des Vorgangs.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
