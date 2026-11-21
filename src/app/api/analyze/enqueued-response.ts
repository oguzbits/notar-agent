import { NextResponse } from 'next/server';
import { DossierJob } from '@/types/jobs';

/** 202-Antwort des Hintergrund-Pfads (auch für die Wiederholung mit gleichem Idempotency-Key). */
export function enqueuedResponse(job: DossierJob): Response {
  return NextResponse.json(
    {
      message: 'Job erfolgreich eingereiht.',
      jobId: job.id,
      status: job.status,
      pollUrl: `/api/jobs/${job.id}`,
    },
    { status: 202 }
  );
}
