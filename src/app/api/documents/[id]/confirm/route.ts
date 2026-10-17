import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authzErrorResponse } from '@/app/api/authz-error-response';
import { requirePermission } from '@/lib/auth/require-permission';
import { confirmField, getDossierFieldsRecord } from '@/lib/dossier/state';
import { logFailure } from '@/lib/observability/logger';
import { getAuditRepository, getDossierRepository } from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { AUDIT_ACTIONS } from '@/types/audit';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { FIELD_STATUS } from '@/types/dossier';

export const dynamic = 'force-dynamic';

const ConfirmFieldRequestSchema = z.object({ fieldKey: z.string().min(1) });

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = ConfirmFieldRequestSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: 'Dokument-ID und Feld erforderlich.' }, { status: 400 });
    }

    const authSupabase = await createServerAuthClient();
    const actor = await requirePermission(authSupabase, PERMISSION_ACTIONS.OVERRIDE_FIELD_STATUS, {
      requestedOrgId: req.headers.get('x-organization-id') || undefined,
      route: 'POST /api/documents/[id]/confirm',
    });
    if (!authSupabase) throw new Error('Authentifizierungsclient nicht verfügbar.');

    const repo = getDossierRepository(authSupabase);
    const stored = await repo.findById(id, actor.organizationId);
    if (!stored) {
      return NextResponse.json({ error: 'Vorgang nicht gefunden.' }, { status: 404 });
    }

    const review = { confirmedAt: new Date().toISOString(), confirmedBy: actor.actorLabel };
    const field = getDossierFieldsRecord(stored.content)[body.data.fieldKey];
    if (field?.status !== FIELD_STATUS.VERIFIED) {
      return NextResponse.json(
        { error: 'Das Feld ist nicht belegt und kann nicht bestätigt werden.' },
        { status: 409 }
      );
    }

    const updated = await repo.update(
      id,
      confirmField(stored.content, body.data.fieldKey, review),
      actor.organizationId
    );
    if (!updated.success) {
      return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 });
    }

    await getAuditRepository(authSupabase).appendEvent({
      documentId: id,
      organizationId: actor.organizationId,
      action: AUDIT_ACTIONS.FIELD_CONFIRMED,
      actor: actor.actorLabel,
      details: { note: `Feld '${body.data.fieldKey}' bestätigt`, actorRole: actor.role },
    });

    return NextResponse.json({ success: true, review });
  } catch (error: unknown) {
    const denied = authzErrorResponse(error);
    if (denied) return denied;
    logFailure('error', 'feld_bestaetigung_fehlgeschlagen', error);
    return NextResponse.json({ error: 'Fehler beim Bestätigen.' }, { status: 500 });
  }
}
