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

  it('trennt Kanzleidaten strikt über organizationId (§ 203 StGB Isolation)', async () => {
    const orgA = '550e8400-e29b-41d4-a716-446655440001';
    const orgB = '550e8400-e29b-41d4-a716-446655440002';
    const docId = 'shared-doc-ref';

    await repo.appendEvent({
      documentId: docId,
      organizationId: orgA,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      actor: 'Notar Kanzlei A',
    });

    await repo.appendEvent({
      documentId: docId,
      organizationId: orgB,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      actor: 'Notar Kanzlei B',
    });

    const historyOrgA = await repo.getHistory(docId, orgA);
    const historyOrgB = await repo.getHistory(docId, orgB);

    expect(historyOrgA).toHaveLength(1);
    expect(historyOrgA[0]?.actor).toBe('Notar Kanzlei A');
    expect(historyOrgA[0]?.organizationId).toBe(orgA);

    expect(historyOrgB).toHaveLength(1);
    expect(historyOrgB[0]?.actor).toBe('Notar Kanzlei B');
    expect(historyOrgB[0]?.organizationId).toBe(orgB);
  });
});

function createErrorMockSupabase(errorMessage: string) {
  const queryBuilder = {
    select() {
      return queryBuilder;
    },
    eq() {
      return queryBuilder;
    },
    order() {
      return {
        limit: async () => ({ data: null, error: { message: errorMessage } }),
        then: (onfulfilled: (res: { data: null; error: { message: string } }) => unknown) =>
          Promise.resolve({ data: null, error: { message: errorMessage } }).then(onfulfilled),
      };
    },
  };

  return {
    from() {
      return queryBuilder;
    },
  };
}

describe('SupabaseAuditRepository (Fail-Fast & SSOT)', () => {
  it('throws an error immediately when Supabase fails to append an event (no silent fallback)', async () => {
    const mockSupabase = createErrorMockSupabase('relation "audit_logs" does not exist');
    const { SupabaseAuditRepository } = await import('./audit-repository');
    const repo = new SupabaseAuditRepository(mockSupabase as never);

    await expect(
      repo.appendEvent({
        documentId: 'doc-err',
        action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
        actor: 'Tester',
      })
    ).rejects.toThrow('Supabase audit fetch error: relation "audit_logs" does not exist');
  });

  it('throws an error when Supabase fails to fetch history', async () => {
    const mockSupabase = createErrorMockSupabase('Database connection timeout');
    const { SupabaseAuditRepository } = await import('./audit-repository');
    const repo = new SupabaseAuditRepository(mockSupabase as never);

    await expect(repo.getHistory('doc-timeout')).rejects.toThrow(
      'Supabase getHistory error: Database connection timeout'
    );
  });
});
