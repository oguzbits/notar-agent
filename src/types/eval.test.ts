import { describe, it, expect } from 'vitest';
import {
  JudgeVerdictSchema,
  JUDGE_VERDICT_STATUS,
  TrajectoryEvalResultSchema,
  LayerEvalSuiteReportSchema,
  RETRIEVAL_QUERY_TYPES,
  RetrievalTestCaseSchema,
  RetrievalScoreSchema,
  RetrievalBenchmarkReportSchema,
} from './eval';

describe('Eval Contracts (src/types/eval.ts)', () => {
  it('validates a valid JudgeVerdict from deterministic or LLM/Jev judge', () => {
    const validVerdict = {
      status: JUDGE_VERDICT_STATUS.PASS,
      score: 1.0,
      matched: true,
      confidence: 0.95,
      reason: 'Semantisch identische Vertragspartei (GmbH in Gründung)',
    };

    const parsed = JudgeVerdictSchema.safeParse(validVerdict);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.score).toBe(1.0);
      expect(parsed.data.status).toBe(JUDGE_VERDICT_STATUS.PASS);
    }
  });

  it('rejects an invalid score or invalid status in JudgeVerdict', () => {
    const invalidVerdict = {
      status: 'UNKNOWN_STATUS',
      score: 1.5, // Muss <= 1.0 sein
      matched: true,
      confidence: 0.5,
      reason: 'Test',
    };

    const parsed = JudgeVerdictSchema.safeParse(invalidVerdict);
    expect(parsed.success).toBe(false);
  });

  it('validates TrajectoryEvalResult for Layer 2 evaluation', () => {
    const trajectoryData = {
      caseId: 'fall-04-standard-urkunde',
      expectedKnowledgeCodes: ['§ 19 GrdstVG', '§ 21 BeurkG'],
      selectedKnowledgeCodes: ['§ 19 GrdstVG', '§ 21 BeurkG', '§ 433 BGB'],
      precision: 0.67,
      recall: 1.0,
      f1Score: 0.8,
      passed: true,
      stepSequenceValid: true,
    };

    const parsed = TrajectoryEvalResultSchema.safeParse(trajectoryData);
    expect(parsed.success).toBe(true);
  });

  it('validates a comprehensive 4-layer suite report', () => {
    const fullReport = {
      runId: 'eval-run-2026-09-25-001',
      timestamp: new Date().toISOString(),
      layer1ComponentPassed: true,
      layer2TrajectoryScore: 0.92,
      layer3OutcomeAccuracy: 96.5,
      layer4Telemetry: {
        totalPromptTokens: 2500,
        totalCompletionTokens: 850,
        totalCostUsd: 0.0042,
        latencyMs: 1420,
      },
      casesTested: 10,
      passed: true,
    };

    const parsed = LayerEvalSuiteReportSchema.safeParse(fullReport);
    expect(parsed.success).toBe(true);
  });

  it('validates RetrievalTestCaseSchema and RetrievalScoreSchema', () => {
    const testCase = {
      id: 'case-geg-10y',
      query: '§ 80 Abs. 2 GEG',
      queryType: RETRIEVAL_QUERY_TYPES.STATUTORY_EXACT,
      description: 'Prüfung der Gültigkeitsdauer eines Energieausweises',
      expectedLegalBases: ['§ 80 Abs. 2 GEG'],
      expectedAnchors: ['10 Jahre'],
      requiredFacts: ['10 Jahre', 'Gültigkeitsdauer'],
    };

    const score = {
      caseId: 'case-geg-10y',
      query: '§ 80 Abs. 2 GEG',
      queryType: RETRIEVAL_QUERY_TYPES.STATUTORY_EXACT,
      hit: true,
      rank: 1,
      reciprocalRank: 1.0,
      anchorRecall: 1.0,
      topLegalBases: ['§ 80 Abs. 2 GEG'],
      latencyMs: 12.5,
    };

    const benchmarkReport = {
      timestamp: new Date().toISOString(),
      strategy: 'BASELINE_LINEAR',
      totalQueries: 1,
      corpusSize: 35,
      hitAt1Rate: 100.0,
      hitAt3Rate: 100.0,
      hitAt5Rate: 100.0,
      meanReciprocalRank: 1.0,
      averageAnchorRecall: 1.0,
      averageLatencyMs: 12.5,
      byQueryType: {
        [RETRIEVAL_QUERY_TYPES.STATUTORY_EXACT]: {
          count: 1,
          hitAt3Rate: 100.0,
          meanReciprocalRank: 1.0,
        },
        [RETRIEVAL_QUERY_TYPES.NUMBER_PARCEL]: { count: 0, hitAt3Rate: 0, meanReciprocalRank: 0 },
        [RETRIEVAL_QUERY_TYPES.SEMANTIC_CONCEPT]: {
          count: 0,
          hitAt3Rate: 0,
          meanReciprocalRank: 0,
        },
        [RETRIEVAL_QUERY_TYPES.DISTRACTOR]: { count: 0, hitAt3Rate: 0, meanReciprocalRank: 0 },
      },
      results: [score],
    };

    expect(RetrievalTestCaseSchema.safeParse(testCase).success).toBe(true);
    expect(RetrievalScoreSchema.safeParse(score).success).toBe(true);
    expect(RetrievalBenchmarkReportSchema.safeParse(benchmarkReport).success).toBe(true);
  });
});
