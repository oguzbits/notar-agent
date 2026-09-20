import { describe, it, expect } from 'vitest';
import { CASE_TYPES, FIELD_STATUS, OVERALL_STATUS } from './dossier';
import { ExtractionStageOutputSchema, AuditorStageOutputSchema } from './pipeline';

describe('Pipeline Stage Contracts (Zod-Schemas)', () => {
  it('ExtractionStageOutputSchema parses valid Stufe 1 payload with defaults', () => {
    const raw = {
      caseTitle: 'Testfall Grundbuch',
      fields: {
        kaufpreis: {
          status: FIELD_STATUS.VERIFIED,
          data: { amountInFigures: 450000 },
        },
      },
    };

    const parsed = ExtractionStageOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.caseTitle).toBe('Testfall Grundbuch');
    expect(parsed.data.caseType).toBe(CASE_TYPES.IMMOBILIENKAUF);
    expect(parsed.data.detectedDocuments).toEqual([]);
    expect(parsed.data.overallStatus).toBe(OVERALL_STATUS.ACTION_REQUIRED);
    expect(parsed.data.fields.kaufpreis?.status).toBe(FIELD_STATUS.VERIFIED);
  });

  it('ExtractionStageOutputSchema gracefully recovers from null or empty payload', () => {
    const parsed = ExtractionStageOutputSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.caseTitle).toBe('');
    expect(parsed.data.fields).toEqual({});
    expect(parsed.data.inquiries).toEqual([]);
  });

  it('AuditorStageOutputSchema accepts Delta-Format with either fields or modifications', () => {
    const deltaWithFields = {
      fields: {
        verkaeufer: {
          status: FIELD_STATUS.NEEDS_REVIEW,
          note: 'Nachweis erforderlich',
        },
      },
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
    };

    const parsed1 = AuditorStageOutputSchema.safeParse(deltaWithFields);
    expect(parsed1.success).toBe(true);

    const deltaWithModifications = {
      modifications: {
        grundstuecke: {
          status: FIELD_STATUS.VERIFIED,
        },
      },
      executiveSummary: 'Alles plausibilisiert.',
    };

    const parsed2 = AuditorStageOutputSchema.safeParse(deltaWithModifications);
    expect(parsed2.success).toBe(true);
  });
});
