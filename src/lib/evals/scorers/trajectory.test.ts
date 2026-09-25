import { describe, it, expect } from 'vitest';
import { scoreTrajectoryKnowledgeSelection } from './trajectory';

describe('Layer 2: Trajectory & Knowledge Scorer', () => {
  it('calculates perfect precision and recall when selected matches expected exactly', () => {
    const result = scoreTrajectoryKnowledgeSelection({
      caseId: 'fall-04',
      expectedKnowledgeCodes: ['§ 19 GrdstVG', '§ 21 BeurkG'],
      selectedKnowledgeCodes: ['§ 19 GrdstVG', '§ 21 BeurkG'],
    });

    expect(result.passed).toBe(true);
    expect(result.precision).toBe(1.0);
    expect(result.recall).toBe(1.0);
    expect(result.f1Score).toBe(1.0);
  });

  it('detects missing critical knowledge documents (low recall)', () => {
    const result = scoreTrajectoryKnowledgeSelection({
      caseId: 'fall-06-energieausweis-prueffrist',
      expectedKnowledgeCodes: ['§ 80 GEG', 'Gültigkeitsdauer 10 Jahre'],
      selectedKnowledgeCodes: ['§ 80 GEG'],
    });

    expect(result.recall).toBe(0.5);
    expect(result.precision).toBe(1.0);
    expect(result.passed).toBe(false); // Recall < 1.0 bei Pflichtnormen schlägt fehl
  });

  it('detects hallucinated or over-selected rules (lower precision)', () => {
    const result = scoreTrajectoryKnowledgeSelection({
      caseId: 'fall-01',
      expectedKnowledgeCodes: ['§ 21 BeurkG'],
      selectedKnowledgeCodes: ['§ 21 BeurkG', '§ 19 GrdstVG', '§ 433 BGB'],
    });

    expect(result.recall).toBe(1.0);
    expect(result.precision).toBeCloseTo(0.33, 2);
    expect(result.passed).toBe(true); // Vollständigkeit erreicht, Warnung über Over-Retrieval
  });
});
