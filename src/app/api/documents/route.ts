import { NextRequest, NextResponse } from 'next/server';
import {
  fetchDossierRecords,
  fetchDossierRecordById,
  deleteDossierRecord,
} from '@/lib/supabase/server';

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
    const { id, orgId } = extractDocumentQueryParams(req);

    if (id) {
      const record = await fetchDossierRecordById(id, orgId);
      if (!record) {
        return NextResponse.json({ error: 'Vorgang nicht gefunden.' }, { status: 404 });
      }
      return NextResponse.json({ document: record });
    }

    const records = await fetchDossierRecords(orgId);
    return NextResponse.json({ documents: records });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Laden der Vorgänge.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const { id, orgId } = extractDocumentQueryParams(req);

    if (!id) {
      return NextResponse.json({ error: 'ID fehlt.' }, { status: 400 });
    }

    const success = await deleteDossierRecord(id, orgId);
    if (!success) {
      return NextResponse.json({ error: 'Vorgang konnte nicht gelöscht werden.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Löschen des Vorgangs.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
