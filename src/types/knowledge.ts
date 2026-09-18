import { z } from 'zod';

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

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[keyof typeof KNOWLEDGE_CATEGORIES];

/**
 * Kanzlei-Wissensdokument / DNotI-Gutachten / Präzedenzfall.
 */
export const KnowledgeDocumentSchema = z.object({
  id: z.uuid(),
  organizationId: z
    .uuid()
    .nullable()
    .describe('Null bei globalen DNotI- und Bundesgerichts-Normen, sonst Kanzlei-isoliert'),
  category: KnowledgeCategorySchema,
  legalBasis: z.string().describe('Z.B. § 12 HGB, § 144 BauGB, DNotI-Report 2023/14'),
  courtOrAuthority: z.string().optional().describe('Z.B. AG Hamburg, OLG München, BGH'),
  title: z.string().min(1),
  content: z.string().min(1),
  triggerKeywords: z.array(z.string()).default([]),
  embedding: z
    .array(z.number())
    .optional()
    .describe('Vektor-Repräsentation (1536 oder 768 Dimensionen)'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

/**
 * Treffer-Struktur für hybride Suchläufe (BM25 Keyword + Vector Similarity).
 */
export const HybridSearchResultSchema = z.object({
  document: KnowledgeDocumentSchema,
  bm25Score: z.number().min(0),
  vectorScore: z.number().min(0).max(1),
  combinedScore: z.number().min(0),
  matchSource: z.enum(['BM25_EXACT', 'SEMANTIC_VECTOR', 'HYBRID_FUSION']),
});

export type HybridSearchResult = z.infer<typeof HybridSearchResultSchema>;

/**
 * Parameter für die hybride Suche.
 */
export const HybridSearchQuerySchema = z.object({
  queryText: z.string().min(1),
  queryEmbedding: z.array(z.number()).optional(),
  category: KnowledgeCategorySchema.optional(),
  organizationId: z.uuid().optional(),
  topK: z.number().int().positive().optional().default(5),
  vectorWeight: z.number().min(0).max(1).optional().default(0.5),
});

export type HybridSearchQuery = z.input<typeof HybridSearchQuerySchema>;
export type HybridSearchQueryParsed = z.output<typeof HybridSearchQuerySchema>;
