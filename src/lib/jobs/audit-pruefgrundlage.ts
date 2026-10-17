import type { IAuditRepository } from '@/lib/audit/audit-repository';
import { AUDIT_SYSTEM_ACTOR_DE } from '@/lib/dossier/constants';
import type { IKnowledgeRepository } from '@/lib/knowledge/knowledge-repository';
import { logFailure } from '@/lib/observability/logger';
import { AUDIT_ACTIONS } from '@/types/audit';
import type { CreateJobPayload } from '@/types/jobs';

/**
 * Hält fest, auf welcher Grundlage geprüft wurde. Scheitert der Eintrag, bleibt der Job abgeschlossen:
 * Eine Wiederholung würde das bereits gespeicherte Dossier doppelt anlegen.
 */
export async function recordPruefgrundlage(
  deps: { auditRepo?: IAuditRepository; knowledgeRepo?: IKnowledgeRepository },
  documentId: string,
  organizationId: string | undefined,
  payload: CreateJobPayload
): Promise<void> {
  if (!deps.auditRepo) return;
  try {
    const rules = deps.knowledgeRepo
      ? await deps.knowledgeRepo.getStatutoryRules(organizationId)
      : [];
    await deps.auditRepo.appendEvent({
      documentId: documentId,
      organizationId: organizationId,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      actor: AUDIT_SYSTEM_ACTOR_DE,
      details: {
        pruefgrundlage: {
          fileNames: payload.files.map((f) => f.name),
          ruleIds: rules.map((r) => r.id),
        },
      },
    });
  } catch (error: unknown) {
    logFailure('error', 'audit_pruefgrundlage_fehlgeschlagen', error);
  }
}
