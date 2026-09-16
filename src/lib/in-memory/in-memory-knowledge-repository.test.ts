import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryKnowledgeRepository,
  cosineSimilarity,
  calculateBM25Score,
  performHybridSearch,
} from '@/lib/in-memory';
import { KNOWLEDGE_CATEGORIES, KnowledgeDocument } from '@/types/knowledge';

describe('InMemoryKnowledgeRepository & In-Memory Hybrid Search Helpers', () => {
  let repository: InMemoryKnowledgeRepository;

  const doc1: KnowledgeDocument = {
    id: '11111111-1111-4111-8111-111111111111',
    organizationId: null, // Global
    category: KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS,
    legalBasis: '§ 12 HGB',
    courtOrAuthority: 'AG Hamburg',
    title: 'Registerauszug Aktualität AG Hamburg',
    content:
      'Das Registergericht Hamburg beanstandet Beschlüsse ohne tagesaktuellen Handelsregisterauszug.',
    triggerKeywords: ['gmbh', 'hamburg', 'registerauszug'],
    embedding: [1, 0, 0],
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-16T08:00:00.000Z',
  };

  const doc2: KnowledgeDocument = {
    id: '22222222-2222-4222-8222-222222222222',
    organizationId: '550e8400-e29b-41d4-a716-446655440000', // Kanzlei A
    category: KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
    legalBasis: 'Kanzleistandard Notariat Dr. Kaufmann',
    title: 'Sonderklausel Kaufpreisanzahlung',
    content:
      'Bei Kaufpreisen über 1 Million Euro verlangen wir zwingend eine Bürgschaft oder Notaranderkonto.',
    triggerKeywords: ['kaufpreis', 'anderkonto', 'million'],
    embedding: [0, 1, 0],
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-16T08:00:00.000Z',
  };

  const doc3: KnowledgeDocument = {
    id: '33333333-3333-4333-8333-333333333333',
    organizationId: '99999999-9999-4999-8999-999999999999', // Kanzlei B
    category: KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
    legalBasis: 'Fremde Kanzlei Klausel',
    title: 'Geheime Kanzleirichtlinie',
    content: 'Interne Abrechnungsmodelle und Vollmachten fremde Kanzlei.',
    triggerKeywords: ['kaufpreis'],
    embedding: [0, 0, 1],
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-16T08:00:00.000Z',
  };

  beforeEach(() => {
    repository = new InMemoryKnowledgeRepository();
    repository.seed([doc1, doc2, doc3]);
  });

  it('calculates cosine similarity correctly and handles zero vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cosineSimilarity([0, 0, 0], [1, 0, 0])).toBe(0);
  });

  it('calculates BM25 term frequency scores accurately', () => {
    const text = 'Das AG Hamburg verlangt den Registerauszug für jede GmbH.';
    const score1 = calculateBM25Score(['gmbh', 'hamburg'], text);
    const score2 = calculateBM25Score(['gmbh'], text);
    expect(score1).toBeGreaterThan(score2);
    expect(calculateBM25Score(['vollmacht'], text)).toBe(0);
  });

  it('enforces strict tenant isolation (§ 203 StGB): Kanzlei A never sees Kanzlei B documents', async () => {
    const resultsKanzleiA = await repository.search({
      queryText: 'gmbh kaufpreis',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
    });

    const docIds = resultsKanzleiA.map((r) => r.document.id);
    expect(docIds).toContain(doc1.id); // Global doc is accessible
    expect(docIds).toContain(doc2.id); // Own org doc is accessible
    expect(docIds).not.toContain(doc3.id); // Foreign org doc must NEVER leak!
  });

  it('performs deterministic hybrid fusion (BM25 + Vector Similarity)', () => {
    const candidates = [doc1, doc2];
    const results = performHybridSearch(candidates, {
      queryText: 'Handelsregister AG Hamburg',
      queryEmbedding: [0.9, 0.1, 0],
      topK: 2,
      vectorWeight: 0.5,
    });

    expect(results.length).toBeGreaterThan(0);
    const firstResult = results[0];
    expect(firstResult).toBeDefined();
    if (!firstResult) return;
    expect(firstResult.document.id).toBe(doc1.id);
    expect(firstResult.bm25Score).toBeGreaterThan(0);
    expect(firstResult.vectorScore).toBeGreaterThan(0.8);
    expect(firstResult.matchSource).toBe('HYBRID_FUSION');
  });
});
