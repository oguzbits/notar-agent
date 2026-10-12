import { describe, it, expect } from 'vitest';
import { BENCHMARK_KNOWLEDGE_CORPUS } from '@/lib/knowledge/fixtures/benchmark-knowledge-corpus';
import { BENCHMARK_QUERIES } from '@/lib/knowledge/fixtures/benchmark-queries';
import {
  RETRIEVAL_QUERY_TYPES,
  RetrievalTestCase,
  RetrievalBenchmarkReport,
  RetrievalTestCaseSchema,
} from '@/types/eval';
import {
  KnowledgeDocument,
  KnowledgeDocumentSchema,
  KNOWLEDGE_CATEGORIES,
} from '@/types/knowledge';
import {
  normalizeText,
  scoreRetrieval,
  aggregateBenchmarkReport,
  compareWithBaseline,
} from './eval-scorers';

describe('Retrieval Eval Scorers (src/lib/knowledge/eval-scorers.ts)', () => {
  const dummyDoc1: KnowledgeDocument = {
    id: 'd0000000-0000-4000-8000-000000000001',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 80 Abs. 2 GEG',
    title: 'Gültigkeit von Energieausweisen (10 Jahre)',
    content:
      'Energieausweise sind gem. § 80 Abs. 2 GEG genau 10 Jahre ab Ausstellungsdatum gültig.',
    triggerKeywords: ['energieausweis'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyDoc2: KnowledgeDocument = {
    id: 'd0000000-0000-4000-8000-000000000002',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 21 BeurkG',
    title: 'Grundbuchstand & Amtliche Einsicht',
    content: 'Vor Beurkundung ist eine amtliche Grundbucheinsicht vorzunehmen.',
    triggerKeywords: ['grundbuch'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyDoc3: KnowledgeDocument = {
    id: 'd0000000-0000-4000-8000-000000000003',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: '§ 47 Abs. 2 GBO',
    title: 'eGbR-Voreintragungspflicht',
    content: 'Eine rechtsfähige GbR muss im Gesellschaftsregister eingetragen sein.',
    triggerKeywords: ['egbr'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const testCase: RetrievalTestCase = {
    id: 'test-geg',
    query: '§ 80 Abs. 2 GEG Energieausweis',
    queryType: RETRIEVAL_QUERY_TYPES.STATUTORY_EXACT,
    description: 'Prüfung Energieausweis Frist',
    expectedLegalBases: ['§ 80 Abs. 2 GEG'],
    expectedAnchors: ['10 Jahre', 'Ausstellungsdatum'],
    requiredFacts: ['10 Jahre'],
  };

  it('normalizes text reliably with NFKC and whitespace collapsing', () => {
    const raw = '  §  80   Abs. 2  GEG \n\t 10 Jahre ';
    const normalized = normalizeText(raw);
    expect(normalized).toBe('§ 80 abs. 2 geg 10 jahre');
  });

  it('scores a rank 1 hit with 100% anchor recall', () => {
    const retrieved = [dummyDoc1, dummyDoc2, dummyDoc3];
    const score = scoreRetrieval(retrieved, testCase, 3, 15.0);

    expect(score.caseId).toBe('test-geg');
    expect(score.hit).toBe(true);
    expect(score.rank).toBe(1);
    expect(score.reciprocalRank).toBe(1.0);
    expect(score.anchorRecall).toBe(1.0);
    expect(score.topLegalBases).toEqual(['§ 80 Abs. 2 GEG', '§ 21 BeurkG', '§ 47 Abs. 2 GBO']);
    expect(score.latencyMs).toBe(15.0);
  });

  it('scores a rank 2 hit with reciprocal rank 0.5', () => {
    const retrieved = [dummyDoc2, dummyDoc1, dummyDoc3];
    const score = scoreRetrieval(retrieved, testCase, 3, 20.0);

    expect(score.hit).toBe(true);
    expect(score.rank).toBe(2);
    expect(score.reciprocalRank).toBe(0.5);
    expect(score.anchorRecall).toBe(1.0);
  });

  it('scores a miss when expected document is outside top-K', () => {
    const retrieved = [dummyDoc2, dummyDoc3];
    const score = scoreRetrieval(retrieved, testCase, 2, 10.0);

    expect(score.hit).toBe(false);
    expect(score.rank).toBeNull();
    expect(score.reciprocalRank).toBe(0.0);
    expect(score.anchorRecall).toBe(0.0);
  });

  it('aggregates individual scores into a valid RetrievalBenchmarkReport', () => {
    const score1 = scoreRetrieval([dummyDoc1], testCase, 3, 10);
    const score2 = scoreRetrieval(
      [dummyDoc2],
      {
        id: 'test-21-beurkg',
        query: 'Grundbucheinsicht vor Beurkundung',
        queryType: RETRIEVAL_QUERY_TYPES.SEMANTIC_CONCEPT,
        description: 'Grundbucheinsicht',
        expectedLegalBases: ['§ 21 BeurkG'],
        expectedAnchors: ['amtliche Grundbucheinsicht'],
        requiredFacts: [],
      },
      3,
      20
    );

    const report = aggregateBenchmarkReport([score1, score2], 'TEST_STRATEGY', 35);

    expect(report.strategy).toBe('TEST_STRATEGY');
    expect(report.totalQueries).toBe(2);
    expect(report.corpusSize).toBe(35);
    expect(report.hitAt1Rate).toBe(100.0);
    expect(report.hitAt3Rate).toBe(100.0);
    expect(report.meanReciprocalRank).toBe(1.0);
    expect(report.averageLatencyMs).toBe(15);
    expect(report.byQueryType.STATUTORY_EXACT.count).toBe(1);
    expect(report.byQueryType.SEMANTIC_CONCEPT.count).toBe(1);
  });

  it('compares current report against baseline and detects regressions', () => {
    const baseline: RetrievalBenchmarkReport = {
      timestamp: '2026-10-12T00:00:00.000Z',
      strategy: 'BASELINE_LINEAR',
      totalQueries: 10,
      corpusSize: 35,
      hitAt1Rate: 70.0,
      hitAt3Rate: 80.0,
      hitAt5Rate: 90.0,
      meanReciprocalRank: 0.75,
      averageAnchorRecall: 0.8,
      averageLatencyMs: 25.0,
      byQueryType: {
        STATUTORY_EXACT: { count: 4, hitAt3Rate: 100.0, meanReciprocalRank: 1.0 },
        NUMBER_PARCEL: { count: 3, hitAt3Rate: 66.7, meanReciprocalRank: 0.6 },
        SEMANTIC_CONCEPT: { count: 3, hitAt3Rate: 66.7, meanReciprocalRank: 0.6 },
        DISTRACTOR: { count: 0, hitAt3Rate: 0, meanReciprocalRank: 0 },
      },
      results: [],
    };

    const improvedReport: RetrievalBenchmarkReport = {
      ...baseline,
      strategy: 'RRF_DYNAMIC',
      hitAt3Rate: 90.0,
      meanReciprocalRank: 0.85,
    };

    const gatePass = compareWithBaseline(improvedReport, baseline);
    expect(gatePass.passed).toBe(true);
    expect(gatePass.mrrDelta).toBeGreaterThan(0);
    expect(gatePass.hitAt3Delta).toBe(10.0);

    const regressedReport: RetrievalBenchmarkReport = {
      ...baseline,
      hitAt3Rate: 60.0, // Regression!
      meanReciprocalRank: 0.55,
    };

    const gateFail = compareWithBaseline(regressedReport, baseline);
    expect(gateFail.passed).toBe(false);
    expect(gateFail.regressions.length).toBeGreaterThan(0);
  });

  it('validates structural integrity and schemas of all 35 benchmark documents and 20 queries', () => {
    expect(BENCHMARK_KNOWLEDGE_CORPUS.length).toBe(35);
    expect(BENCHMARK_QUERIES.length).toBe(20);

    for (const doc of BENCHMARK_KNOWLEDGE_CORPUS) {
      const parsed = KnowledgeDocumentSchema.safeParse(doc);
      expect(parsed.success).toBe(true);
    }

    for (const query of BENCHMARK_QUERIES) {
      const parsed = RetrievalTestCaseSchema.safeParse(query);
      expect(parsed.success).toBe(true);
    }
  });
});
