import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { scoreRetrieval } from '@/lib/knowledge/eval-scorers';
import { BENCHMARK_KNOWLEDGE_CORPUS } from '@/lib/knowledge/fixtures/benchmark-knowledge-corpus';
import { BENCHMARK_QUERIES } from '@/lib/knowledge/fixtures/benchmark-queries';
import { SupabaseKnowledgeRepository } from '@/lib/knowledge/supabase-knowledge-repository';
import { DB_TABLES } from '@/types/database';
import { createDbHarness, type TestUser } from './db-harness';

const TOP_K = 3;
/** Untergrenze für Recall@3 der Produktionssuche gegen das Benchmark-Korpus. */
const MIN_HIT_RATE = 0.9;

describe('Retrieval-Qualität der Produktionssuche', () => {
  let user: TestUser;
  let orgId: string;

  beforeAll(async () => {
    const harness = createDbHarness();
    user = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(user.id);
    const rows = BENCHMARK_KNOWLEDGE_CORPUS.map((doc) => ({
      id: randomUUID(),
      organization_id: orgId,
      category: doc.category,
      legal_basis: doc.legalBasis,
      court_or_authority: doc.courtOrAuthority ?? null,
      title: doc.title,
      content: doc.content,
      trigger_keywords: doc.triggerKeywords,
    }));
    const inserted = await harness.admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS).insert(rows);
    expect(inserted.error).toBeNull();
  });

  it('misst Recall@3 der echten RPC', async () => {
    const repo = new SupabaseKnowledgeRepository(user.client as never);
    const scores = [];
    for (const testCase of BENCHMARK_QUERIES) {
      const hits = await repo.search({
        queryText: testCase.query,
        organizationId: orgId,
        topK: TOP_K,
      });
      scores.push(
        scoreRetrieval(
          hits.map((h) => h.document),
          testCase,
          TOP_K
        )
      );
    }
    const hitRate = scores.filter((score) => score.hit).length / scores.length;
    const missed = scores.filter((score) => !score.hit).map((score) => score.caseId);

    expect(missed).toEqual([]);
    expect(hitRate).toBeGreaterThanOrEqual(MIN_HIT_RATE);
    expect(scores.length).toBe(BENCHMARK_QUERIES.length);
  });
});
