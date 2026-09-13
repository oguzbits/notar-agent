import { describe, it, expect } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { selectRelevantAuditRules } from './rule-selector';

describe('RAG Auditor: selectRelevantAuditRules', () => {
  it('enthält immer allgemeine Basiskriterien (GEG 10 Jahre, Grundbuch § 21 BeurkG)', () => {
    const rules = selectRelevantAuditRules({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      fields: {},
      detectedDocuments: [],
      notes: '',
    });

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('RULE_GEG_10_YEARS');
    expect(ruleIds).toContain('RULE_BEURKG_21_GRUNDBUCH');
  });

  it('wählt MoPeG/eGbR-Regeln aus, wenn GbR in Verkäufer oder Käufer vorkommt', () => {
    const rules = selectRelevantAuditRules({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      fields: {
        verkaeufer: {
          data: {
            parties: [{ name: 'Müller & Schmidt GbR', legalForm: 'GbR' }],
          },
        },
      },
      detectedDocuments: [],
      notes: '',
    });

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('RULE_MOPEG_EGBR');
    const mopegRule = rules.find((r) => r.id === 'RULE_MOPEG_EGBR');
    expect(mopegRule?.legalBasis).toContain('§ 707 BGB');
  });

  it('wählt HGB § 12 Registerregeln aus, wenn eine GmbH oder KG beteiligt ist', () => {
    const rules = selectRelevantAuditRules({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      fields: {
        kaeufer: {
          data: {
            name: 'Alpha Invest GmbH',
            legalForm: 'GmbH',
          },
        },
      },
      detectedDocuments: [],
      notes: '',
    });

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('RULE_HGB_12_REGISTER');
  });

  it('wählt MaBV-Ratenregeln aus, wenn Bauträgerkauf oder Ratenzahlung erwähnt werden', () => {
    const rules = selectRelevantAuditRules({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      fields: {
        kaufpreis: {
          data: {
            paymentTerms: 'Zahlung in 7 Raten nach Baufortschritt',
          },
        },
      },
      detectedDocuments: [],
      notes: '',
    });

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain('RULE_MABV_RATES');
  });

  it('formatiert die selektierten Regeln in einen kompakten Prompt-Auszug mit Paragraphenbelegen', () => {
    const rules = selectRelevantAuditRules({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      fields: {
        verkaeufer: {
          data: {
            parties: [{ name: 'Test GbR', legalForm: 'GbR' }],
          },
        },
      },
      detectedDocuments: [],
      notes: '',
    });

    const formatted = rules.map((r) => `[${r.legalBasis}] ${r.instruction}`).join('\n');
    expect(formatted).toContain('§ 707 BGB');
    expect(formatted).toContain('Gesellschaftsregister');
  });
});
