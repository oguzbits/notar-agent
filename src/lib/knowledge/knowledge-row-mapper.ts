import { DB_TABLES, TableInsert } from '@/types/database';
import {
  KNOWLEDGE_REVIEW_STATUS,
  KnowledgeDocument,
  KnowledgeReviewStatusSchema,
} from '@/types/knowledge';

type KnowledgeRow = Record<string, unknown>;

function optionalText(value: unknown): string | undefined {
  return value ? String(value) : undefined;
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function governanceFields(row: KnowledgeRow) {
  return {
    sourceReference: optionalText(row.source_reference),
    validFrom: optionalText(row.valid_from),
    validUntil: optionalText(row.valid_until),
    version: Number(row.version ?? 1),
    reviewStatus: KnowledgeReviewStatusSchema.parse(
      row.review_status ?? KNOWLEDGE_REVIEW_STATUS.UNGEPRUEFT
    ),
  };
}

export function rowToDocument(row: KnowledgeRow): KnowledgeDocument {
  const nowIso = new Date().toISOString();
  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    category: row.category as KnowledgeDocument['category'],
    legalBasis: String(row.legal_basis),
    courtOrAuthority: optionalText(row.court_or_authority),
    title: String(row.title),
    content: String(row.content),
    triggerKeywords: textList(row.trigger_keywords),
    isGlobal: Boolean(row.is_global ?? false),
    suggestedAction: optionalText(row.suggested_action),
    ...governanceFields(row),
    createdAt: String(row.created_at ?? nowIso),
    updatedAt: String(row.updated_at ?? nowIso),
  };
}

export function documentToRow(
  doc: KnowledgeDocument
): TableInsert<typeof DB_TABLES.KNOWLEDGE_DOCUMENTS> {
  return {
    id: doc.id,
    organization_id: doc.organizationId ?? null,
    category: doc.category,
    legal_basis: doc.legalBasis,
    court_or_authority: doc.courtOrAuthority ?? null,
    title: doc.title,
    content: doc.content,
    trigger_keywords: doc.triggerKeywords,
    embedding: doc.embedding ?? null,
    source_reference: doc.sourceReference ?? null,
    valid_from: doc.validFrom ?? null,
    valid_until: doc.validUntil ?? null,
    version: doc.version ?? 1,
    review_status: doc.reviewStatus ?? KNOWLEDGE_REVIEW_STATUS.UNGEPRUEFT,
  };
}
