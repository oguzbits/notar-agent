import { NextRequest, NextResponse, after } from 'next/server';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { requirePermission } from '@/lib/auth/require-permission';
import { DELETION_WORKER_DEFAULTS, processDeletionTasks } from '@/lib/dossier/deletion-worker';
import { logFailure } from '@/lib/observability/logger';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import {
  DossierBusyError,
  DossierDeletionForbiddenError,
  DossierNotFoundError,
} from '@/lib/supabase/repository';
import {
  fetchDossierRecords,
  fetchDossierRecordById,
  deleteDossierRecord,
} from '@/lib/supabase/server';
import { createServerAuthClient, resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { DeleteDossierRequestSchema } from '@/types/deletion';

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
    logFailure('error', 'documents_fehlgeschlagen', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Vorgänge.' }, { status: 500 });
  }
}

/** Räumt die Storage-Dateien nur dieser Akte sofort ab; Fehler fängt später der tägliche Cron auf. */
async function purgeStorageFor(documentId: string): Promise<void> {
  try {
    await processDeletionTasks(createServiceRoleClient(), {
      ...DELETION_WORKER_DEFAULTS,
      documentId,
    });
  } catch (err: unknown) {
    logFailure('warn', 'loeschung_nachlauf_fehlgeschlagen', err);
  }
}

function deletionErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof DossierNotFoundError) {
    return NextResponse.json({ error: 'Vorgang nicht gefunden.' }, { status: 404 });
  }
  if (error instanceof DossierDeletionForbiddenError) {
    return NextResponse.json({ error: 'Keine Berechtigung zum Löschen.' }, { status: 403 });
  }
  if (error instanceof DossierBusyError) {
    return NextResponse.json(
      { error: 'Für den Vorgang läuft noch eine Verarbeitung. Bitte später erneut versuchen.' },
      { status: 409 }
    );
  }
  return null;
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const authSupabase = await createServerAuthClient();
    const { id, orgId: queryOrgId } = extractDocumentQueryParams(req);
    await requirePermission(authSupabase, PERMISSION_ACTIONS.DELETE_DOSSIER, {
      requestedOrgId: queryOrgId,
      route: 'DELETE /api/documents',
    });

    if (!id) {
      return NextResponse.json({ error: 'ID fehlt.' }, { status: 400 });
    }

    const body: unknown = await req.json().catch(() => ({}));
    const parsed = DeleteDossierRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Löschgrund fehlt oder ist ungültig.' }, { status: 400 });
    }

    const receipt = await deleteDossierRecord(id, parsed.data.reason, authSupabase);
    if (receipt.storageTasks > 0) {
      try {
        after(() => purgeStorageFor(id));
      } catch (afterErr: unknown) {
        // after() ist außerhalb eines Request-Kontexts (Tests) nicht verfügbar
        logFailure('info', 'after_nicht_verfuegbar', afterErr);
        void purgeStorageFor(id);
      }
    }
    return NextResponse.json({ receipt });
  } catch (error: unknown) {
    const denied = authzErrorResponse(error);
    if (denied) return denied;
    const known = deletionErrorResponse(error);
    if (known) return known;
    logFailure('error', 'dossier_loeschen_fehlgeschlagen', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Vorgangs.' }, { status: 500 });
  }
}
