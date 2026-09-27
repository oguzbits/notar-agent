import { z } from 'zod';
import { DossierSchema } from './dossier';

export const CASE_STATUS = {
  IN_PROGRESS: 'In Prüfung',
  DRAFT_READY: 'Entwurfsreif',
} as const;

export const CaseStatusSchema = z.enum([CASE_STATUS.IN_PROGRESS, CASE_STATUS.DRAFT_READY]);

export type CaseStatus = (typeof CASE_STATUS)[keyof typeof CASE_STATUS];

export const DocumentRecordSchema = z.object({
  id: z.string().min(1, 'ID darf nicht leer sein'),
  organizationId: z
    .uuid()
    .optional()
    .describe('Kanzlei-ID für RLS Mandantentrennung gem. § 203 StGB'),
  title: z.string(),
  status: CaseStatusSchema,
  content: DossierSchema,
  created_at: z.string(),
  updated_at: z.string().optional(),
});

export type DocumentRecord = z.infer<typeof DocumentRecordSchema>;

/**
 * Spatial Bounding-Box für auditierbare Belege (§ 17 BeurkG).
 */
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

/**
 * Ein einzelnes strukturiertes Layout-Element oder eine Annotation.
 */
export const DocumentLayoutBlockSchema = z.object({
  pageNumber: z.number().int().min(1),
  type: z.enum(['text', 'heading', 'table', 'annotation', 'form_field']),
  content: z.string(),
  bbox: BoundingBoxSchema.optional(),
});
export type DocumentLayoutBlock = z.infer<typeof DocumentLayoutBlockSchema>;

/**
 * Standardisiertes Dokumenten-Parsing-Ergebnis für Agenten (Document Context Layer).
 */
export const DocumentParsedContentSchema = z.object({
  markdown: z
    .string()
    .describe('Strukturiertes Markdown (Überschriften, Tabellen, Absätze) für LLM-Prompts'),
  totalPages: z.number().int().min(0),
  blocks: z.array(DocumentLayoutBlockSchema).default([]),
  characterCount: z.number().int().min(0),
  hasTextLayer: z.boolean(),
  needsOcr: z.boolean().default(false),
  pageScreenshots: z
    .array(
      z.object({
        pageNum: z.number().int(),
        width: z.number(),
        height: z.number(),
        base64Png: z.string(),
      })
    )
    .optional()
    .describe('Optionale gerenderte PNG-Screenshots für visuelle Overlays'),
  extractedImages: z
    .array(
      z.object({
        id: z.string(),
        pageNumber: z.number().int().min(1),
        format: z.string(),
        base64Data: z.string(),
        mediaType: z.string(),
        bbox: BoundingBoxSchema,
        width: z.number(),
        height: z.number(),
      })
    )
    .optional()
    .describe('Eingebettete Bildausschnitte (Siegel, Stempel, Signaturen) mit Koordinaten'),
  metadata: z
    .object({
      creator: z.string().optional(),
      producer: z.string().optional(),
      formType: z.number().optional(),
    })
    .default({}),
});
export type DocumentParsedContent = z.infer<typeof DocumentParsedContentSchema>;
