import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { FIELD_STATUS, OVERALL_STATUS } from '@/types/dossier';
import { GOLDEN_DATASET } from './golden-dataset';
import { calculatePercentiles, scoreDossierAgainstGroundTruth } from './scorer';

describe('Eval Scorer & Metrics Calculation', () => {
  it('correctly calculates percentiles (P50, P90, P95, P99)', () => {
    // 100 Werte von 1 bis 100
    const latencies = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
    const p = calculatePercentiles(latencies);

    expect(p.min).toBe(10);
    expect(p.max).toBe(1000);
    expect(p.p50).toBe(505);
    expect(p.p90).toBe(901);
    expect(p.p95).toBe(951);
    expect(p.p99).toBe(990);
    expect(p.avg).toBe(505);
  });

  it('scores exact ground truth match as 100% accuracy and provenance', () => {
    // Verwende fall-04-standard-urkunde (Standard-Kaufvertrag mit 4 verifizierten Feldern)
    const testCase = GOLDEN_DATASET.find((c) => c.id === 'fall-04-standard-urkunde')!;
    const mockDossier = createTestImmobilienDossier({
      caseTitle: 'Test',
      overallStatus: OVERALL_STATUS.READY,
      fields: {
        verkaeufer: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            name: 'Maria Fischer',
            legalForm: 'natürliche Person',
          },
          source: {
            fileName: 'Kaufvertrag_Koeln_UR89.pdf',
            pageNumber: 1,
            snippet: 'Maria Fischer',
          },
        },
        kaeufer: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            companyName: 'Jan Schmidt',
            legalForm: 'natürliche Person',
          },
          source: { fileName: 'Kaufvertrag_Koeln_UR89.pdf', pageNumber: 1, snippet: 'Jan Schmidt' },
        },
        kaufpreis: {
          status: FIELD_STATUS.VERIFIED,
          data: { amountInFigures: 550000 },
          source: {
            fileName: 'Kaufvertrag_Koeln_UR89.pdf',
            pageNumber: 1,
            snippet: '550.000,00 EUR',
          },
        },
        grundbuch: {
          status: FIELD_STATUS.VERIFIED,
          data: { blatt: '1042' },
          source: { fileName: 'Kaufvertrag_Koeln_UR89.pdf', pageNumber: 1, snippet: 'Blatt 1042' },
        },
      },
    });

    const result = scoreDossierAgainstGroundTruth(testCase, mockDossier);
    expect(result.accuracyRate).toBe(100);
    expect(result.provenanceCoverageRate).toBe(100);
    expect(result.matchingFieldsCount).toBe(4);
    expect(result.totalFieldsTested).toBe(4);
  });

  it('detects discrepancies and flags missing provenance', () => {
    const testCase = GOLDEN_DATASET.find((c) => c.id === 'fall-04-standard-urkunde')!;
    const mockDossier = createTestImmobilienDossier({
      caseTitle: 'Test',
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        verkaeufer: {
          status: FIELD_STATUS.NEEDS_REVIEW, // Abweichung zu VERIFIED
          source: { fileName: '', pageNumber: 0, snippet: '' }, // Fehlende Provenance
        },
        kaeufer: {
          status: FIELD_STATUS.VERIFIED,
          source: { fileName: 'Kaufvertrag_Koeln_UR89.pdf', pageNumber: 1, snippet: 'Jan Schmidt' },
        },
      },
    });

    const result = scoreDossierAgainstGroundTruth(testCase, mockDossier);
    expect(result.accuracyRate).toBeLessThan(100);
    expect(result.provenanceCoverageRate).toBeLessThan(100);
  });
});
