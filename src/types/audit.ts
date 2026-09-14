import { z } from 'zod';
import { FieldStatusSchema } from './dossier';

export const AUDIT_ACTIONS = {
  DOCUMENT_INGESTED: 'DOCUMENT_INGESTED',
  AI_ANALYSIS_COMPLETED: 'AI_ANALYSIS_COMPLETED',
  USER_STATUS_OVERRIDE: 'USER_STATUS_OVERRIDE',
  USER_NOTE_MODIFIED: 'USER_NOTE_MODIFIED',
  DOSSIER_APPENDED: 'DOSSIER_APPENDED',
} as const;

export const AuditActionSchema = z.enum([
  AUDIT_ACTIONS.DOCUMENT_INGESTED,
  AUDIT_ACTIONS.AI_ANALYSIS_COMPLETED,
  AUDIT_ACTIONS.USER_STATUS_OVERRIDE,
  AUDIT_ACTIONS.USER_NOTE_MODIFIED,
  AUDIT_ACTIONS.DOSSIER_APPENDED,
]);

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AuditSourceFingerprintSchema = z.object({
  fileName: z.string(),
  sha256: z.string().length(64, 'SHA-256 Hash muss exakt 64 Hex-Zeichen lang sein'),
  sizeBytes: z.number().nonnegative(),
});
export type AuditSourceFingerprint = z.infer<typeof AuditSourceFingerprintSchema>;

export const AuditOverrideDetailsSchema = z.object({
  fieldKey: z.string().min(1, 'fieldKey ist erforderlich'),
  fieldTitle: z.string().optional(),
  previousStatus: FieldStatusSchema,
  newStatus: FieldStatusSchema,
  reason: z
    .string()
    .min(3, 'Pflichtbegründung gem. § 17 BeurkG muss mindestens 3 Zeichen umfassen'),
});
export type AuditOverrideDetails = z.infer<typeof AuditOverrideDetailsSchema>;

export const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().min(1),
  sequenceNumber: z.number().int().nonnegative(),
  action: AuditActionSchema,
  timestamp: z.string().datetime(),
  actor: z.string().min(1),
  previousHash: z.string().min(1),
  currentHash: z.string().length(64),
  details: z
    .object({
      override: AuditOverrideDetailsSchema.optional(),
      sourceFingerprints: z.array(AuditSourceFingerprintSchema).optional(),
      note: z.string().optional(),
      caseTitle: z.string().optional(),
    })
    .default({}),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const AuditIntegrityResultSchema = z.object({
  valid: z.boolean(),
  totalEntries: z.number().int().nonnegative(),
  brokenSequenceIndex: z.number().optional(),
  error: z.string().optional(),
});

export type AuditIntegrityResult = z.infer<typeof AuditIntegrityResultSchema>;
