import { NextRequest, NextResponse } from 'next/server';
import { getAuditRepository } from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Dokument-ID fehlt.' }, { status: 400 });
    }

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

    const auditRepo = getAuditRepository(authSupabase);
    const history = await auditRepo.getHistory(id, orgId);
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
