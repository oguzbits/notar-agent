import { calculateAuditRecordHash, GENESIS_HASH, verifyAuditChain } from '@/lib/audit/audit-crypto';
import { IAuditRepository, AppendAuditParams } from '@/lib/audit/audit-repository';
import { AuditIntegrityResult, AuditLogEntry } from '@/types/audit';

/**
 * Bounded In-Memory Audit Repository mit mathematischer Hash-Kette und Mandantentrennung (§ 203 StGB).
 * Ausschließlich für isolierte Tests und lokale Demo-Zwecke.
 */
export class InMemoryAuditRepository implements IAuditRepository {
  private eventsByDocId = new Map<string, AuditLogEntry[]>();
  private readonly maxEntriesPerDoc: number;

  constructor(maxEntriesPerDoc = 100) {
    this.maxEntriesPerDoc = maxEntriesPerDoc;
  }

  async appendEvent(params: AppendAuditParams): Promise<AuditLogEntry> {
    const list = this.eventsByDocId.get(params.documentId) || [];
    const sequenceNumber = list.length;
    const lastEntry = list[list.length - 1];
    const previousHash = lastEntry ? lastEntry.currentHash : GENESIS_HASH;
    const timestamp = params.timestamp || new Date().toISOString();
    const details = params.details || {};

    const currentHash = calculateAuditRecordHash({
      documentId: params.documentId,
      sequenceNumber,
      action: params.action,
      timestamp,
      actor: params.actor,
      previousHash,
      details,
    });

    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      organizationId: params.organizationId,
      documentId: params.documentId,
      sequenceNumber,
      action: params.action,
      timestamp,
      actor: params.actor,
      previousHash,
      currentHash,
      details,
    };

    list.push(entry);
    if (list.length > this.maxEntriesPerDoc) {
      list.shift();
    }
    this.eventsByDocId.set(params.documentId, list);

    return entry;
  }

  async getHistory(documentId: string, organizationId?: string): Promise<AuditLogEntry[]> {
    const list = this.eventsByDocId.get(documentId) || [];
    const filtered = organizationId
      ? list.filter((e) => !e.organizationId || e.organizationId === organizationId)
      : list;

    return filtered.map((e) => ({ ...e }));
  }

  async verifyIntegrity(
    documentId: string,
    organizationId?: string
  ): Promise<AuditIntegrityResult> {
    const history = await this.getHistory(documentId, organizationId);
    return verifyAuditChain(history);
  }
}
