import { NextRequest, NextResponse } from 'next/server';
import {
  fetchDossierRecords,
  fetchDossierRecordById,
  deleteDossierRecord,
} from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';

function extractDocumentQueryParams(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const orgId =
    req.headers.get('x-organization-id') || searchParams.get('organizationId') || undefined;
  return { id, orgId };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    const { id, orgId: queryOrgId } = extractDocumentQueryParams(req);
    const orgId = await resolveSessionOrganizationId(authSupabase, queryOrgId);
    if (!orgId)
      return NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      );

    if (id) {
      const record = await fetchDossierRecordById(id, orgId, authSupabase);
      if (!record) {
        return NextResponse.json({ error: 'Vorgang nicht gefunden.' }, { status: 404 });
      }
      return NextResponse.json({ document: record });
    }

    const records = await fetchDossierRecords(orgId, authSupabase);
    return NextResponse.json({ documents: records });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Laden der Vorgänge.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    const { id, orgId: queryOrgId } = extractDocumentQueryParams(req);
    const orgId = await resolveSessionOrganizationId(authSupabase, queryOrgId);
    if (!orgId)
      return NextResponse.json(
        { error: 'Nicht authentifiziert oder keine Kanzlei zugeordnet.' },
        { status: 401 }
      );

    if (!id) {
      return NextResponse.json({ error: 'ID fehlt.' }, { status: 400 });
    }

    const success = await deleteDossierRecord(id, orgId, authSupabase);
    if (!success) {
      return NextResponse.json({ error: 'Vorgang konnte nicht gelöscht werden.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Löschen des Vorgangs.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
