import { z } from 'zod';
import { DbUuidSchema } from './primitives';

/**
 * Kategorien für notarielle Wissenseinträge gem. § 2.1 & C.3 Roadmap.
 */
export const KNOWLEDGE_CATEGORIES = {
  GESETZLICHE_NORM: 'GESETZLICHE_NORM',
  DNOTI_GUTACHTEN: 'DNOTI_GUTACHTEN',
  AMTSGERICHT_PRAXIS: 'AMTSGERICHT_PRAXIS',
  KANZLEI_RICHTLINIE: 'KANZLEI_RICHTLINIE',
} as const;

export const KnowledgeCategorySchema = z.enum([
  KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
  KNOWLEDGE_CATEGORIES.DNOTI_GUTACHTEN,
  KNOWLEDGE_CATEGORIES.AMTSGERICHT_PRAXIS,
  KNOWLEDGE_CATEGORIES.KANZLEI_RICHTLINIE,
]);

/** Prüfstatus eines Wissenseintrags; zurückgezogene Einträge werden nie ausgeliefert. */
export const KNOWLEDGE_REVIEW_STATUS = {
  UNGEPRUEFT: 'UNGEPRUEFT',
  GEPRUEFT: 'GEPRUEFT',
  ZURUECKGEZOGEN: 'ZURUECKGEZOGEN',
} as const;

export const KnowledgeReviewStatusSchema = z.enum([
  KNOWLEDGE_REVIEW_STATUS.UNGEPRUEFT,
  KNOWLEDGE_REVIEW_STATUS.GEPRUEFT,
  KNOWLEDGE_REVIEW_STATUS.ZURUECKGEZOGEN,
]);

export type KnowledgeReviewStatus =
  (typeof KNOWLEDGE_REVIEW_STATUS)[keyof typeof KNOWLEDGE_REVIEW_STATUS];

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[keyof typeof KNOWLEDGE_CATEGORIES];

/**
 * Kanzlei-Wissensdokument / DNotI-Gutachten / Präzedenzfall.
 */
/** Dimension der Spalte knowledge_documents.embedding (vector(1536)). */
export const EMBEDDING_DIMENSIONS = 1536;

export const EmbeddingVectorSchema = z.array(z.number().finite()).length(EMBEDDING_DIMENSIONS);

export const KnowledgeDocumentSchema = z.object({
  id: DbUuidSchema,
  organizationId: DbUuidSchema.nullable().describe(
    'Null bei globalen DNotI- und Bundesgerichts-Normen, sonst Kanzlei-isoliert'
  ),
  category: KnowledgeCategorySchema,
  legalBasis: z.string().describe('Z.B. § 12 HGB, § 144 BauGB, DNotI-Report 2023/14'),
  courtOrAuthority: z.string().optional().describe('Z.B. AG Hamburg, OLG München, BGH'),
  title: z.string().min(1),
  content: z.string().min(1),
  triggerKeywords: z.array(z.string()).default([]),
  isGlobal: z
    .boolean()
    .default(false)
    .optional()
    .describe('Wenn true, wird die Regel für den Vorgangstyp immer berücksichtigt'),
  suggestedAction: z
    .string()
    .optional()
    .describe('Optionale Handlungsempfehlung bei Beanstandung/Mangel'),
  embedding: z
    .array(z.number())
    .optional()
    .describe('Vektor-Repräsentation (1536 oder 768 Dimensionen)'),
  sourceReference: z.string().optional().describe('Fundstelle bzw. Quelle des Eintrags'),
  validFrom: z.iso.date().optional().describe('Gültig ab (einschließlich)'),
  validUntil: z.iso.date().optional().describe('Gültig bis (einschließlich)'),
  version: z.number().int().min(1).optional().describe('Fehlt = Version 1'),
  reviewStatus: KnowledgeReviewStatusSchema.optional().describe('Fehlt = ungeprüft'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

export const MATCH_SOURCES = {
  TEXT_MATCH: 'TEXT_MATCH',
  SEMANTIC_VECTOR: 'SEMANTIC_VECTOR',
  HYBRID_FUSION: 'HYBRID_FUSION',
} as const;

export type MatchSource = (typeof MATCH_SOURCES)[keyof typeof MATCH_SOURCES];

/**
 * Treffer-Struktur für hybride Suchläufe (Volltext mit ts_rank_cd + Vector Similarity + RRF Fusion).
 */
export const HybridSearchResultSchema = z.object({
  document: KnowledgeDocumentSchema,
  textScore: z.number().min(0),
  vectorScore: z.number().min(0).max(1),
  combinedScore: z.number().min(0),
  matchSource: z.enum([
    MATCH_SOURCES.TEXT_MATCH,
    MATCH_SOURCES.SEMANTIC_VECTOR,
    MATCH_SOURCES.HYBRID_FUSION,
  ]),
  textRank: z.number().int().positive().nullable().optional(),
  vectorRank: z.number().int().positive().nullable().optional(),
  rrfScore: z.number().min(0).optional(),
});

export type HybridSearchResult = z.infer<typeof HybridSearchResultSchema>;

/**
 * Parameter für die hybride Suche (inkl. dynamischer RRF-Gewichtung).
 */
export const HybridSearchQuerySchema = z.object({
  queryText: z.string().min(1),
  queryEmbedding: z.array(z.number()).optional(),
  category: KnowledgeCategorySchema.optional(),
  organizationId: DbUuidSchema.optional(),
  topK: z.number().int().positive().optional().default(5),
  vectorWeight: z.number().min(0).max(1).optional().default(0.5),
  textWeight: z.number().min(0).max(1).optional().default(0.5),
  rrfK: z.number().int().positive().optional().default(60),
});

export type HybridSearchQuery = z.input<typeof HybridSearchQuerySchema>;
export type HybridSearchQueryParsed = z.output<typeof HybridSearchQuerySchema>;
