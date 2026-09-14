import { describe, it, expect, beforeEach } from 'vitest';
import { AUDIT_ACTIONS } from '@/types/audit';
import { InMemoryAuditRepository } from './audit-repository';

describe('InMemoryAuditRepository (§ 17 ff. BeurkG)', () => {
  let repo: InMemoryAuditRepository;

  beforeEach(() => {
    repo = new InMemoryAuditRepository(10);
  });

  it('appends genesis and subsequent events maintaining unbroken hash-chain', async () => {
    const docId = 'test-doc-1';

    const e0 = await repo.appendEvent({
      documentId: docId,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      actor: 'Ingestion Service',
      details: { caseTitle: 'Kaufvertrag Test' },
    });

    expect(e0.sequenceNumber).toBe(0);
    expect(e0.previousHash).toHaveLength(64);
    expect(e0.currentHash).toHaveLength(64);

    const e1 = await repo.appendEvent({
      documentId: docId,
      action: AUDIT_ACTIONS.AI_ANALYSIS_COMPLETED,
      actor: 'AI Auditor',
    });

    expect(e1.sequenceNumber).toBe(1);
    expect(e1.previousHash).toBe(e0.currentHash);

    const history = await repo.getHistory(docId);
    expect(history).toHaveLength(2);

    const integrity = await repo.verifyIntegrity(docId);
    expect(integrity.valid).toBe(true);
    expect(integrity.totalEntries).toBe(2);
  });

  it('returns valid integrity for empty history', async () => {
    const integrity = await repo.verifyIntegrity('empty-doc');
    expect(integrity.valid).toBe(true);
    expect(integrity.totalEntries).toBe(0);
  });

  it('keeps history isolated per documentId', async () => {
    await repo.appendEvent({
      documentId: 'doc-a',
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      actor: 'User A',
    });

    await repo.appendEvent({
      documentId: 'doc-b',
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      actor: 'User B',
    });

    const histA = await repo.getHistory('doc-a');
    const histB = await repo.getHistory('doc-b');

    expect(histA).toHaveLength(1);
    expect(histB).toHaveLength(1);
    expect(histA[0]?.documentId).toBe('doc-a');
    expect(histB[0]?.documentId).toBe('doc-b');
  });
});
