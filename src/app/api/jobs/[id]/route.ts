import { NextRequest, NextResponse } from 'next/server';
import { getJobRepository } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: 'Job-ID erforderlich' }, { status: 400 });
  }

  const repo = getJobRepository();
  const job = await repo.getJobById(id);

  if (!job) {
    return NextResponse.json({ error: `Job mit ID '${id}' nicht gefunden.` }, { status: 404 });
  }

  return NextResponse.json(job, { status: 200 });
}
