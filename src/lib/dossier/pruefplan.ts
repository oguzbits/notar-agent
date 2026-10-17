import { CaseType } from '@/types/dossier';
import { KNOWLEDGE_REVIEW_STATUS, KnowledgeDocument } from '@/types/knowledge';
import { Pruefplan } from '@/types/pruefplan';
import { CASE_TYPE_METADATA_REGISTRY } from './constants';

/**
 * Leitet den Prüfplan vor dem Lauf ab: Pflichtfelder aus der Registry, Regeln ausschließlich
 * aus der Wissensbasis. Inhalte der Regeln gehören nicht in den Plan.
 */
export function buildPruefplan(caseType: CaseType, rules: KnowledgeDocument[]): Pruefplan {
  const fields = Object.entries(CASE_TYPE_METADATA_REGISTRY[caseType])
    .sort(([, a], [, b]) => a.index - b.index)
    .map(([fieldKey, meta]) => ({ fieldKey, title: meta.title }));

  const planRules = rules.map((r) => ({
    id: r.id,
    title: r.title,
    legalBasis: r.legalBasis,
    reviewStatus: r.reviewStatus ?? KNOWLEDGE_REVIEW_STATUS.UNGEPRUEFT,
  }));

  return {
    caseType,
    fields,
    rules: planRules,
    ruleBasisReviewed:
      planRules.length > 0 &&
      planRules.every((r) => r.reviewStatus === KNOWLEDGE_REVIEW_STATUS.GEPRUEFT),
  };
}
