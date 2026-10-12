import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion } from './rrf-fusion';

describe('Reciprocal Rank Fusion (src/lib/knowledge/rrf-fusion.ts)', () => {
  const docA = { id: 'doc-A', title: 'Dokument A' };
  const docB = { id: 'doc-B', title: 'Dokument B' };
  const docC = { id: 'doc-C', title: 'Dokument C' };
  const docD = { id: 'doc-D', title: 'Dokument D' };

  it('boosts a document that appears in both rankers (reciprocal rank addition)', () => {
    // Text ranked: A (rank 1), B (rank 2)
    // Vector ranked: B (rank 1), C (rank 2)
    // Even though A is #1 in text and B is #2, B appears in both (#2 text + #1 vector).
    // B score = 0.5/(60+2) + 0.5/(60+1) = 0.5/62 + 0.5/61 ≈ 0.00806 + 0.00820 = 0.01626
    // A score = 0.5/(60+1) ≈ 0.00820
    const textRanked = [docA, docB];
    const vectorRanked = [docB, docC];

    const fused = reciprocalRankFusion(textRanked, vectorRanked, 0.5, 0.5, 60, 5);

    expect(fused.length).toBe(3);
    expect(fused[0]?.item.id).toBe('doc-B'); // B gewinnt durch Fusions-Bonus!
    expect(fused[0]?.textRank).toBe(2);
    expect(fused[0]?.vectorRank).toBe(1);
    expect(fused[1]?.item.id).toBe('doc-A');
  });

  it('honors high textWeight when text ranking is prioritized', () => {
    // When textWeight is 0.85 and vectorWeight is 0.15:
    // docA (rank 1 in text): 0.85 / 61 ≈ 0.01393
    // docC (rank 1 in vector): 0.15 / 61 ≈ 0.00245
    const textRanked = [docA];
    const vectorRanked = [docC];

    const fused = reciprocalRankFusion(textRanked, vectorRanked, 0.85, 0.15, 60, 5);

    expect(fused[0]?.item.id).toBe('doc-A');
    expect(fused[0]?.score).toBeGreaterThan(fused[1]?.score ?? 0);
    expect(fused[1]?.item.id).toBe('doc-C');
  });

  it('handles empty lists gracefully without throwing', () => {
    const fused1 = reciprocalRankFusion([], [docA], 0.5, 0.5);
    expect(fused1.length).toBe(1);
    expect(fused1[0]?.item.id).toBe('doc-A');

    const fused2 = reciprocalRankFusion([docB], [], 0.5, 0.5);
    expect(fused2.length).toBe(1);
    expect(fused2[0]?.item.id).toBe('doc-B');

    const fusedEmpty = reciprocalRankFusion([], [], 0.5, 0.5);
    expect(fusedEmpty).toEqual([]);
  });

  it('respects the limit parameter', () => {
    const textRanked = [docA, docB, docC, docD];
    const vectorRanked = [docD, docC, docB, docA];

    const fused = reciprocalRankFusion(textRanked, vectorRanked, 0.5, 0.5, 60, 2);
    expect(fused.length).toBe(2);
  });
});
