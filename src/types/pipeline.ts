import { z } from 'zod';
import {
  CaseTypeSchema,
  CASE_TYPES,
  DocumentReliabilitySchema,
  DOCUMENT_RELIABILITY,
  NOTAR_DOCUMENT_TYPES,
  InquirySchema,
  OverallStatusSchema,
  OVERALL_STATUS,
  SourceLocationSchema,
  FieldStatusSchema,
  FIELD_STATUS,
} from './dossier';

/**
 * Roh-Dokument-Erkennung aus Stufe 1.
 */
export const DetectedDocumentPayloadSchema = z.object({
  fileName: z.string().default('Unbenanntes Dokument'),
  documentType: z.string().default(NOTAR_DOCUMENT_TYPES.SONSTIGES),
  date: z.string().default(''),
  pageCount: z.number().int().nonnegative().default(1),
  reliability: DocumentReliabilitySchema.default(DOCUMENT_RELIABILITY.MEDIUM),
  summary: z.string().default(''),
});
export type DetectedDocumentPayload = z.infer<typeof DetectedDocumentPayloadSchema>;

/**
 * Einzelnes Rohfeld aus Stufe 1 oder Stufe 2.
 */
export const StageFieldPayloadSchema = z.object({
  status: FieldStatusSchema.default(FIELD_STATUS.NEEDS_REVIEW),
  data: z.record(z.string(), z.unknown()).default({}),
  source: SourceLocationSchema.partial().default({ fileName: '', pageNumber: 0, snippet: '' }),
  note: z.string().default(''),
});
export type StageFieldPayload = z.infer<typeof StageFieldPayloadSchema>;

/**
 * Generisches Feld-Dictionary für Stufe 1 Extraktion.
 */
export const ExtractionFieldsRecordSchema = z.record(
  z.string(),
  StageFieldPayloadSchema.partial().passthrough()
);
export type ExtractionFieldsRecord = z.infer<typeof ExtractionFieldsRecordSchema>;

/**
 * Zod-Vertrag für den Output von Stufe 1 (Extraction Agent).
 * Defensiv konstruiert, um Modell-Variationen sicher aufzufangen.
 */
export const ExtractionStageOutputSchema = z
  .object({
    caseType: CaseTypeSchema.default(CASE_TYPES.IMMOBILIENKAUF),
    caseTitle: z.string().default(''),
    analysisTimestamp: z.string().default(() => new Date().toISOString()),
    detectedDocuments: z.array(DetectedDocumentPayloadSchema).default([]),
    fields: ExtractionFieldsRecordSchema.default({}),
    inquiries: z.array(InquirySchema).default([]),
    overallStatus: OverallStatusSchema.default(OVERALL_STATUS.ACTION_REQUIRED),
    executiveSummary: z.string().default(''),
  })
  .passthrough();
export type ExtractionStageOutput = z.infer<typeof ExtractionStageOutputSchema>;

/**
 * Zod-Vertrag für den Output von Stufe 2 (Notary Auditor & Reconciler).
 * Unterstützt sowohl das Delta-Format (unter "fields" oder "modifications")
 * als auch übergeordnete Status-/Titel-Anpassungen.
 */
export const AuditorStageOutputSchema = z
  .object({
    fields: ExtractionFieldsRecordSchema.optional(),
    modifications: ExtractionFieldsRecordSchema.optional(),
    inquiries: z.array(InquirySchema).optional(),
    overallStatus: OverallStatusSchema.optional(),
    executiveSummary: z.string().optional(),
    caseTitle: z.string().optional(),
  })
  .passthrough();
export type AuditorStageOutput = z.infer<typeof AuditorStageOutputSchema>;
