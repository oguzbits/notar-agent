import { describe, it, expect } from 'vitest';
import { AUDIT_ACTIONS } from '@/types/audit';

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
    const mockSupabase = createErrorMockSupabase('relation does not exist');
    const { SupabaseAuditRepository } = await import('./audit-repository');
    const repo = new SupabaseAuditRepository(mockSupabase as never);

    await expect(
      repo.appendEvent({
        documentId: 'doc-err',
        action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
        actor: 'Tester',
      })
    ).rejects.toThrow('Supabase audit fetch error: relation does not exist');
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
