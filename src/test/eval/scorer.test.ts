import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { FIELD_STATUS, OVERALL_STATUS } from '@/types/dossier';
import { JUDGE_VERDICT_STATUS } from '@/types/eval';
import { GOLDEN_DATASET } from './golden-dataset';
import { scoreDossierAgainstGroundTruth } from './scorer';

describe('Eval Scorer & Metrics Calculation', () => {
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

  it('produces structured fieldVerdicts using DeterministicJudge for Layer 3 evaluation', () => {
    const testCase = GOLDEN_DATASET.find((c) => c.id === 'fall-04-standard-urkunde')!;
    const mockDossier = createTestImmobilienDossier({
      caseTitle: 'Test',
      overallStatus: OVERALL_STATUS.READY,
      fields: {
        verkaeufer: {
          status: FIELD_STATUS.VERIFIED,
          data: { name: 'Maria Fischer', legalForm: 'natürliche Person' },
          source: {
            fileName: 'Kaufvertrag_Koeln_UR89.pdf',
            pageNumber: 1,
            snippet: 'Maria Fischer',
          },
        },
      },
    });

    const result = scoreDossierAgainstGroundTruth(testCase, mockDossier);
    expect(result.fieldVerdicts).toBeDefined();
    expect(result.fieldVerdicts.length).toBeGreaterThan(0);
    const verkaeuferVerdict = result.fieldVerdicts.find((v) => v.fieldKey === 'verkaeufer');
    expect(verkaeuferVerdict).toBeDefined();
    expect(verkaeuferVerdict?.verdict.status).toBe(JUDGE_VERDICT_STATUS.PASS);
    expect(verkaeuferVerdict?.hasProvenance).toBe(true);
  });
});
