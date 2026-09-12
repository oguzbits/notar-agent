import { NextRequest, NextResponse } from 'next/server';
import {
  fetchDossierRecords,
  fetchDossierRecordById,
  deleteDossierRecord,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const record = await fetchDossierRecordById(id);
      if (!record) {
        return NextResponse.json({ error: 'Vorgang nicht gefunden.' }, { status: 404 });
      }
      return NextResponse.json({ document: record });
    }

    const records = await fetchDossierRecords();
    return NextResponse.json({ documents: records });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Laden der Vorgänge.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID fehlt.' }, { status: 400 });
    }

    const success = await deleteDossierRecord(id);
    if (!success) {
      return NextResponse.json({ error: 'Vorgang konnte nicht gelöscht werden.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Fehler beim Löschen des Vorgangs.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
