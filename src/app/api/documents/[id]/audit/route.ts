import { NextRequest, NextResponse } from 'next/server';
import { getAuditRepository } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Dokument-ID fehlt.' }, { status: 400 });
    }

    const auditRepo = getAuditRepository();
    const history = await auditRepo.getHistory(id);
    const integrity = await auditRepo.verifyIntegrity(id);

    return NextResponse.json({
      documentId: id,
      history,
      integrity,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Laden des Audit-Trails.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
