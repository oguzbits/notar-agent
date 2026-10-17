import { describe, it, expect } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_REVIEW_STATUS,
  KnowledgeDocument,
} from '@/types/knowledge';
import { buildPruefplan } from './pruefplan';

function rule(id: string, reviewStatus?: KnowledgeDocument['reviewStatus']): KnowledgeDocument {
  return {
    id,
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
    legalBasis: 'Testnorm',
    title: `Regel ${id}`,
    content: 'Inhalt, der nicht im Plan erscheint',
    triggerKeywords: [],
    reviewStatus,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
const ID_A = 'a0000000-0000-4000-8000-00000000000a';
const ID_B = 'a0000000-0000-4000-8000-00000000000b';

describe('buildPruefplan', () => {
  it('nennt die Pflichtfelder der Vorgangsart in Reihenfolge und nur Regeln aus der Wissensbasis', () => {
    const plan = buildPruefplan(CASE_TYPES.IMMOBILIENKAUF, [
      rule(ID_A, KNOWLEDGE_REVIEW_STATUS.GEPRUEFT),
    ]);
    expect(plan.fields[0]).toEqual({ fieldKey: 'verkaeufer', title: 'Verkäufer' });
    expect(plan.rules).toEqual([
      {
        id: ID_A,
        title: `Regel ${ID_A}`,
        legalBasis: 'Testnorm',
        reviewStatus: KNOWLEDGE_REVIEW_STATUS.GEPRUEFT,
      },
    ]);
    expect(JSON.stringify(plan)).not.toContain('Inhalt, der nicht im Plan erscheint');
  });

  it('wertet fehlenden Prüfstatus als ungeprüft und meldet eine nicht geprüfte Regelgrundlage', () => {
    const plan = buildPruefplan(CASE_TYPES.IMMOBILIENKAUF, [
      rule(ID_A, KNOWLEDGE_REVIEW_STATUS.GEPRUEFT),
      rule(ID_B),
    ]);
    expect(plan.rules[1]?.reviewStatus).toBe(KNOWLEDGE_REVIEW_STATUS.UNGEPRUEFT);
    expect(plan.ruleBasisReviewed).toBe(false);
  });

  it('meldet auch eine leere Regelgrundlage als nicht geprüft', () => {
    expect(buildPruefplan(CASE_TYPES.IMMOBILIENKAUF, []).ruleBasisReviewed).toBe(false);
  });

  it('meldet vollständig geprüfte Regeln als geprüft', () => {
    const plan = buildPruefplan(CASE_TYPES.IMMOBILIENKAUF, [
      rule(ID_A, KNOWLEDGE_REVIEW_STATUS.GEPRUEFT),
    ]);
    expect(plan.ruleBasisReviewed).toBe(true);
  });
});
