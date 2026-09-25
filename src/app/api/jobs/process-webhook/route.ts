import { NextRequest, NextResponse } from 'next/server';
import { executeDossierJob } from '@/lib/jobs/job-worker';
import { SupabaseJobWebhookPayloadSchema, JOB_STATUS } from '@/types/jobs';

export async function POST(req: NextRequest): Promise<Response> {
  const secretHeader = req.headers.get('x-webhook-secret');
  const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!expectedSecret || secretHeader !== expectedSecret) {
    return NextResponse.json(
      { error: 'Ungültiges oder fehlendes Webhook-Secret' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (jsonErr) {
    console.warn('[Webhook] Ungültiger JSON-Body empfangen:', jsonErr);
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const parsed = SupabaseJobWebhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ungültiger Webhook-Payload', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { record } = parsed.data;

  // Nur Jobs verarbeiten, die neu oder wieder auf PENDING stehen
  if (record.status !== JOB_STATUS.PENDING) {
    return NextResponse.json({ message: 'Job ignoriert (nicht PENDING)' }, { status: 200 });
  }

  try {
    const executedJob = await executeDossierJob(record.id);
    return NextResponse.json(
      { success: true, jobId: record.id, jobStatus: executedJob?.status },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook] Fehler bei der Ausführung von Job:', record.id, error);
    return NextResponse.json(
      { error: 'Fehler bei der Job-Ausführung', jobId: record.id },
      { status: 500 }
    );
  }
}
