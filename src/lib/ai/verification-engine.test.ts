import { describe, it, expect } from 'vitest';
import { runNotaryVerification } from '@/lib/ai/verification-engine';
import { CASE_TYPES, ENERGIEAUSWEIS_TYPES, FIELD_STATUS, OVERALL_STATUS } from '@/types/dossier';
import { ExtractionStageOutput } from '@/types/pipeline';

describe('runNotaryVerification (Unified Deep Verification Engine)', () => {
  const dummySources = [
    {
      fileName: 'Kaufvertrag.pdf',
      textContent:
        'Der Kaufpreis beträgt 500.000 Euro. Er ist zahlbar in zwei Raten zu je 250.000 Euro. Verkäufer: Dr. Hans Peter Müller.',
    },
    {
      fileName: 'Grundbuch.pdf',
      textContent: 'Eigentümer lt. Grundbuch: Hans Peter Müller. Flurstück 100 mit 400 m².',
    },
  ];

  it('runs fact checking and domain guardrails in a single unified step', () => {
    const stageOutput: ExtractionStageOutput = {
      caseTitle: 'Test Vorgang',
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      analysisTimestamp: new Date().toISOString(),
      executiveSummary: '',
      detectedDocuments: [],
      inquiries: [],
      fields: {
        kaufpreis: {
          data: { amountInFigures: 500000 },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Kaufvertrag.pdf',
            snippet: 'Der Kaufpreis beträgt 500.000 Euro.',
          },
        },
        verkaeufer: {
          data: {
            name: 'Dr. Hans Peter Müller',
            registeredOwnersGrundbuch: ['Hans Peter Müller'],
          },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Kaufvertrag.pdf',
            snippet: 'Verkäufer: Dr. Hans Peter Müller.',
          },
        },
        energieausweis: {
          data: {
            validUntil: '2020-01-01', // abgelaufen
            certificateType: ENERGIEAUSWEIS_TYPES.BEDARFSAUSWEIS,
          },
          status: FIELD_STATUS.VERIFIED,
          source: {
            fileName: 'Energie.pdf',
            snippet: 'Gültig bis 2020',
          },
        },
      },
    };

    const result = runNotaryVerification({
      stageOutput,
      sourceDocuments: dummySources,
      referenceDate: new Date('2026-09-20'),
    });

    // 1. Kaufpreis & Verkäufer bleiben verifiziert (Fakten stimmen überein)
    expect(result.fields.kaufpreis?.status).toBe(FIELD_STATUS.VERIFIED);
    expect(result.fields.verkaeufer?.status).toBe(FIELD_STATUS.VERIFIED);

    // 2. Energieausweis wird durch die Guardrail-Stufe automatisch auf OUTDATED gesetzt
    expect(result.fields.energieausweis?.status).toBe(FIELD_STATUS.OUTDATED);
    expect(result.fields.energieausweis?.data?.isExpired).toBe(true);
  });
});
