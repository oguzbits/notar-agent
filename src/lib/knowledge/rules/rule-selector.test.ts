import { describe, it, expect } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { KNOWLEDGE_CATEGORIES } from '@/types/knowledge';
import { selectRelevantAuditRules, formatRulesForPrompt } from './rule-selector';
import { AUDIT_RULE_IDS } from './rules-registry';

describe('RAG Auditor: selectRelevantAuditRules', () => {
  it('enthält immer allgemeine Basiskriterien (GEG 10 Jahre, Grundbuch § 21 BeurkG)', () => {
    const rules = selectRelevantAuditRules({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      fields: {},
      detectedDocuments: [],
      notes: '',
    });

    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain(AUDIT_RULE_IDS.RULE_GEG_10_YEARS);
    expect(ruleIds).toContain(AUDIT_RULE_IDS.RULE_BEURKG_21_GRUNDBUCH);
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
    expect(ruleIds).toContain(AUDIT_RULE_IDS.RULE_MOPEG_EGBR);
    const mopegRule = rules.find((r) => r.id === AUDIT_RULE_IDS.RULE_MOPEG_EGBR);
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
    expect(ruleIds).toContain(AUDIT_RULE_IDS.RULE_HGB_12_REGISTER);
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
    expect(ruleIds).toContain(AUDIT_RULE_IDS.RULE_MABV_RATES);
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

  it('formatiert erweiterte Kanzlei- & DNotI-Wissenseinträge nahtlos im Prompt', () => {
    const rules = selectRelevantAuditRules({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      fields: {},
    });

    const knowledgeResult = {
      document: {
        id: '11111111-1111-4111-8111-111111111111',
        organizationId: null,
        category: KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS,
        legalBasis: '§ 12 HGB',
        courtOrAuthority: 'AG Hamburg',
        title: 'Registerauszug Frist',
        content: 'Registerauszug nicht älter als 14 Tage erforderlich.',
        triggerKeywords: ['gmbh'],
        createdAt: '2026-09-16T08:00:00.000Z',
        updatedAt: '2026-09-16T08:00:00.000Z',
      },
      bm25Score: 3.5,
      vectorScore: 0.9,
      combinedScore: 4.4,
      matchSource: 'HYBRID_FUSION' as const,
    };

    const promptText = formatRulesForPrompt(rules, [knowledgeResult]);
    expect(promptText).toContain('=== GESETZLICHE PRÜFUNGSMASSSTÄBE ===');
    expect(promptText).toContain('=== EINSCHLÄGIGE DNOTI-GUTACHTEN & AMTSGERICHTS-PRAXIS ===');
    expect(promptText).toContain('AG Hamburg');
    expect(promptText).toContain('Registerauszug nicht älter als 14 Tage');
  });
});
