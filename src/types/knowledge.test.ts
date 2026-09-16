import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_CATEGORIES,
  KnowledgeCategorySchema,
  KnowledgeDocumentSchema,
  HybridSearchResultSchema,
  HybridSearchQuerySchema,
} from './knowledge';

describe('Knowledge Domain Types & Contracts', () => {
  it('validates canonical knowledge categories', () => {
    expect(KnowledgeCategorySchema.parse(KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM)).toBe(
      KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM
    );
    expect(KnowledgeCategorySchema.parse(KNOWLEDGE_CATEGORIES.DNOTI_GUTACHTEN)).toBe(
      KNOWLEDGE_CATEGORIES.DNOTI_GUTACHTEN
    );
    expect(KnowledgeCategorySchema.parse(KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS)).toBe(
      KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS
    );
    expect(KnowledgeCategorySchema.parse(KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE)).toBe(
      KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE
    );
  });

  it('validates a valid KnowledgeDocument instance', () => {
    const doc = {
      id: '11111111-1111-4111-8111-111111111111',
      organizationId: null,
      category: KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS,
      legalBasis: '§ 12 HGB',
      courtOrAuthority: 'AG Hamburg - Registergericht',
      title: 'Erfordernis des tagesaktuellen Handelsregisterauszugs',
      content:
        'Bei Verfügungen durch eine GmbH verlangt das Registergericht Hamburg stets einen Registerauszug, der nicht älter als 14 Tage ist.',
      triggerKeywords: ['gmbh', 'hamburg', 'registerauszug'],
      embedding: [0.12, 0.45, -0.67],
      createdAt: '2026-09-16T08:00:00.000Z',
      updatedAt: '2026-09-16T08:00:00.000Z',
    };

    const parsed = KnowledgeDocumentSchema.parse(doc);
    expect(parsed.id).toBe(doc.id);
    expect(parsed.organizationId).toBeNull();
  });

  it('validates hybrid search query and result schemas', () => {
    const query = {
      queryText: 'GmbH Vertretung Hamburg',
      topK: 3,
    };
    const parsedQuery = HybridSearchQuerySchema.parse(query);
    expect(parsedQuery.vectorWeight).toBe(0.5);
    expect(parsedQuery.topK).toBe(3);

    const result = {
      document: {
        id: '11111111-1111-4111-8111-111111111111',
        organizationId: null,
        category: KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS,
        legalBasis: '§ 12 HGB',
        title: 'AG Hamburg Praxis',
        content: 'Prüfmaßstab Registerauszug',
        triggerKeywords: ['gmbh'],
        createdAt: '2026-09-16T08:00:00.000Z',
        updatedAt: '2026-09-16T08:00:00.000Z',
      },
      bm25Score: 4.5,
      vectorScore: 0.88,
      combinedScore: 5.38,
      matchSource: 'HYBRID_FUSION' as const,
    };

    const parsedResult = HybridSearchResultSchema.parse(result);
    expect(parsedResult.combinedScore).toBe(5.38);
  });
});
