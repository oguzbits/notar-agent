import { describe, it, expect } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { KNOWLEDGE_CATEGORIES, KnowledgeDocument } from '@/types/knowledge';
import { selectApplicableKnowledge, formatKnowledgeForPrompt } from './rule-selector';

describe('RAG Knowledge Engine: selectApplicableKnowledge & formatKnowledgeForPrompt', () => {
  const sampleStatutoryRules: KnowledgeDocument[] = [
    {
      id: 'd0000000-0000-4000-8000-000000000001',
      organizationId: null,
      category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
      legalBasis: '§ 80 Abs. 2 GEG',
      title: 'Gültigkeit von Energieausweisen (10 Jahre)',
      content: 'Energieausweise sind 10 Jahre gültig.',
      triggerKeywords: ['energieausweis'],
      isGlobal: true,
      suggestedAction: 'Neuen Ausweis anfordern.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'd0000000-0000-4000-8000-000000000002',
      organizationId: null,
      category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
      legalBasis: '§ 21 BeurkG',
      title: 'Grundbuchstand & Amtliche Einsicht',
      content: 'Grundbucheinsicht vor Beurkundung erforderlich.',
      triggerKeywords: ['grundbuch'],
      isGlobal: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'd0000000-0000-4000-8000-000000000003',
      organizationId: null,
      category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
      legalBasis: '§ 707 BGB, § 47 Abs. 2 GBO n.F. (MoPeG)',
      title: 'eGbR-Voreintragungspflicht',
      content: 'GbR muss im Gesellschaftsregister eingetragen sein.',
      triggerKeywords: ['gbr', 'gesellschaft bürgerlichen rechts', 'egbr'],
      isGlobal: false,
      suggestedAction: 'Eintragungsnachweis anfordern.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'd0000000-0000-4000-8000-000000000004',
      organizationId: null,
      category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
      legalBasis: '§ 12 HGB, § 21 BNotO',
      title: 'Vertretungsnachweis juristischer Personen',
      content: 'Handelsregisterauszug zwingend erforderlich.',
      triggerKeywords: ['gmbh', 'ug', 'ag', 'kg'],
      isGlobal: false,
      suggestedAction: 'Registerauszug amtlich abrufen.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'd0000000-0000-4000-8000-000000000005',
      organizationId: null,
      category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
      legalBasis: '§ 3 MaBV',
      title: 'MaBV-Ratenstaffel',
      content: 'Raten müssen den MaBV-Staffeln entsprechen.',
      triggerKeywords: ['bauträger', 'baufortschritt', 'mabv', 'raten'],
      isGlobal: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('enthält immer allgemeine Basiskriterien (isGlobal: true)', () => {
    const selected = selectApplicableKnowledge(sampleStatutoryRules, {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      fields: {},
      detectedDocuments: [],
      notes: '',
    });

    const ids = selected.map((r) => r.id);
    expect(ids).toContain('d0000000-0000-4000-8000-000000000001');
    expect(ids).toContain('d0000000-0000-4000-8000-000000000002');
  });

  it('wählt MoPeG/eGbR-Regeln aus, wenn GbR in Verkäufer oder Käufer vorkommt', () => {
    const selected = selectApplicableKnowledge(sampleStatutoryRules, {
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

    const ids = selected.map((r) => r.id);
    expect(ids).toContain('d0000000-0000-4000-8000-000000000003');
    const mopegRule = selected.find((r) => r.id === 'd0000000-0000-4000-8000-000000000003');
    expect(mopegRule?.legalBasis).toContain('§ 707 BGB');
  });

  it('wählt HGB § 12 Registerregeln aus, wenn eine GmbH oder KG beteiligt ist', () => {
    const selected = selectApplicableKnowledge(sampleStatutoryRules, {
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

    const ids = selected.map((r) => r.id);
    expect(ids).toContain('d0000000-0000-4000-8000-000000000004');
  });

  it('wählt MaBV-Ratenregeln aus, wenn Bauträgerkauf oder Ratenzahlung erwähnt werden', () => {
    const selected = selectApplicableKnowledge(sampleStatutoryRules, {
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

    const ids = selected.map((r) => r.id);
    expect(ids).toContain('d0000000-0000-4000-8000-000000000005');
  });

  it('formatiert die selektierten Regeln in einen kompakten Prompt-Auszug mit Paragraphenbelegen', () => {
    const selected = selectApplicableKnowledge(sampleStatutoryRules, {
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

    const formatted = formatKnowledgeForPrompt(selected);
    expect(formatted).toContain('§ 707 BGB');
    expect(formatted).toContain('=== GESETZLICHE PRÜFUNGSMASSSTÄBE ===');
  });

  it('formatiert erweiterte Kanzlei- & DNotI-Wissenseinträge nahtlos im Prompt', () => {
    const selected = selectApplicableKnowledge(sampleStatutoryRules, {
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
        isGlobal: false,
        createdAt: '2026-09-16T08:00:00.000Z',
        updatedAt: '2026-09-16T08:00:00.000Z',
      },
      bm25Score: 3.5,
      vectorScore: 0.9,
      combinedScore: 4.4,
      matchSource: 'HYBRID_FUSION' as const,
    };

    const promptText = formatKnowledgeForPrompt(selected, [knowledgeResult]);
    expect(promptText).toContain('=== GESETZLICHE PRÜFUNGSMASSSTÄBE ===');
    expect(promptText).toContain('=== EINSCHLÄGIGE DNOTI-GUTACHTEN & AMTSGERICHTS-PRAXIS ===');
    expect(promptText).toContain('AG Hamburg');
    expect(promptText).toContain('Registerauszug nicht älter als 14 Tage');
  });
});
