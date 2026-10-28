import { getAuditRepository } from '@/lib/supabase/server';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { AUDIT_ACTIONS } from '@/types/audit';
import { SessionContext } from '@/types/auth';
import { Dossier, UpdateDossierRequest } from '@/types/dossier';

// Revisionssicherer Audit-Trail (§ 17 ff. BeurkG)
export async function appendOverrideAudit(
  authSupabase: Awaited<ReturnType<typeof createServerAuthClient>>,
  params: {
    documentId: string;
    organizationId: string;
    override: NonNullable<UpdateDossierRequest['auditOverride']>;
    dossier: Dossier;
    sessionActor: SessionContext;
  }
): Promise<void> {
  const { documentId, organizationId, override, dossier, sessionActor } = params;
  await getAuditRepository(authSupabase).appendEvent({
    documentId,
    organizationId,
    action: AUDIT_ACTIONS.USER_STATUS_OVERRIDE,
    actor: sessionActor.actorLabel,
    details: { override, caseTitle: dossier.caseTitle, actorRole: sessionActor.role },
  });
}
