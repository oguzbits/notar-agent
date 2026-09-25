import { describe, it, expect } from 'vitest';
import {
  JudgeVerdictSchema,
  JUDGE_VERDICT_STATUS,
  TrajectoryEvalResultSchema,
  LayerEvalSuiteReportSchema,
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
});
