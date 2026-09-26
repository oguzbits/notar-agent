import { describe, it, expect } from 'vitest';
import { ENERGIEAUSWEIS_TYPES, FIELD_STATUS, GenericFieldDossier } from '@/types/dossier';
import { applyNotaryDomainGuardrails } from './domain-guardrails';

describe('Deterministic Domain Guardrails (Pure TypeScript)', () => {
  it('automatically sets Energieausweis to OUTDATED and isExpired: true when validUntil is in the past', () => {
    const fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>>> = {
      energieausweis: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          validUntil: '2024-05-01',
          isExpired: false,
          certificateType: ENERGIEAUSWEIS_TYPES.BEDARFSAUSWEIS,
        },
        source: { fileName: 'energieausweis.pdf', pageNumber: 1, snippet: 'Gültig bis 01.05.2024' },
        note: '',
      },
    };

    const referenceDate = new Date('2026-09-20T00:00:00.000Z');
    applyNotaryDomainGuardrails(fieldsObj, { referenceDate });

    expect(fieldsObj.energieausweis?.status).toBe(FIELD_STATUS.OUTDATED);
    expect(fieldsObj.energieausweis?.data.isExpired).toBe(true);
    expect(fieldsObj.energieausweis?.note).toContain('abgelaufen');
  });

  it('keeps Energieausweis VERIFIED when validUntil is in the future', () => {
    const fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>>> = {
      energieausweis: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          validUntil: '2030-12-31',
          isExpired: false,
          certificateType: ENERGIEAUSWEIS_TYPES.VERBRAUCHSAUSWEIS,
        },
        source: { fileName: 'energieausweis.pdf', pageNumber: 1, snippet: 'Gültig bis 31.12.2030' },
        note: '',
      },
    };

    const referenceDate = new Date('2026-09-20T00:00:00.000Z');
    applyNotaryDomainGuardrails(fieldsObj, { referenceDate });

    expect(fieldsObj.energieausweis?.status).toBe(FIELD_STATUS.VERIFIED);
    expect(fieldsObj.energieausweis?.data.isExpired).toBe(false);
  });

  it('flags arithmetic parcel area discrepancy between parcel sum and totalAreaM2', () => {
    const fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>>> = {
      grundstuecke: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          parcels: [
            { flurstueckNummer: '12/1', sizeM2: 500 },
            { flurstueckNummer: '12/2', sizeM2: 300 },
          ],
          totalAreaM2: 1000, // Diskrepanz: 500 + 300 = 800 != 1000
        },
        source: { fileName: 'grundbuch.pdf', pageNumber: 2, snippet: 'Flurstücke' },
        note: '',
      },
    };

    applyNotaryDomainGuardrails(fieldsObj);

    expect(fieldsObj.grundstuecke?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(fieldsObj.grundstuecke?.note).toContain('Rechnerische Flächendiskrepanz');
  });

  it('flags arithmetic rent discrepancy between monthly quote and yearlyNetRent', () => {
    const fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>>> = {
      mietverhaeltnisse: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          statedInEmailOrOverview: '2.000 € monatlich',
          yearlyNetRent: 20000, // Diskrepanz: 2000 * 12 = 24.000 != 20.000
        },
        source: { fileName: 'email.pdf', pageNumber: 1, snippet: 'Miete' },
        note: '',
      },
    };

    applyNotaryDomainGuardrails(fieldsObj);

    expect(fieldsObj.mietverhaeltnisse?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(fieldsObj.mietverhaeltnisse?.note).toContain('Rechnerische Mietdiskrepanz');
  });

  it('matches seller entity across titles without triggering false alarms', () => {
    const fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>>> = {
      verkaeufer: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          name: 'Dr. Hans-Peter Müller',
          registeredOwnersGrundbuch: ['Hans Peter Müller'],
          representationProofProvided: false,
        },
        source: { fileName: 'vertrag.pdf', pageNumber: 1, snippet: 'Verkäufer' },
        note: '',
      },
    };

    applyNotaryDomainGuardrails(fieldsObj);

    // Dr. Hans-Peter Müller matcht Hans Peter Müller -> bleibt VERIFIED
    expect(fieldsObj.verkaeufer?.status).toBe(FIELD_STATUS.VERIFIED);
  });

  it('automatically sets Kaufpreis to NEEDS_REVIEW when snippet or previousOffers indicate handwritten amendments or strike-throughs', () => {
    const fieldsObj: Record<string, GenericFieldDossier<Record<string, unknown>>> = {
      kaufpreis: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          amountInFigures: 425000,
          previousOffers: [450000],
          isFinalAgreedPrice: true,
        },
        source: {
          fileName: 'Kaufvertrag_Auszug.pdf',
          pageNumber: 1,
          snippet:
            'Der Kaufpreis betraegt 425.000,00 EUR (urspruenglich 450.000,00 EUR, Absprache v. 12.03.2026, Paraphe Weber).',
        },
        note: 'Minderung basierend auf vorheriger Absprache dokumentiert.',
      },
    };

    applyNotaryDomainGuardrails(fieldsObj);

    expect(fieldsObj.kaufpreis?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(fieldsObj.kaufpreis?.note).toContain('Handschriftliche Änderung oder Streichung');
  });
});
