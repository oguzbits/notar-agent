import { z } from 'zod';
import { PermissionActionSchema } from './auth';
import { DeletionReasonSchema } from './deletion';
import { FieldStatusSchema } from './dossier';
import { DbUuidSchema } from './primitives';

export const AUDIT_ACTIONS = {
  DOCUMENT_INGESTED: 'DOCUMENT_INGESTED',
  AI_ANALYSIS_COMPLETED: 'AI_ANALYSIS_COMPLETED',
  USER_STATUS_OVERRIDE: 'USER_STATUS_OVERRIDE',
  USER_NOTE_MODIFIED: 'USER_NOTE_MODIFIED',
  DOSSIER_APPENDED: 'DOSSIER_APPENDED',
  DOSSIER_ARCHIVED: 'DOSSIER_ARCHIVED',
  DOSSIER_RESTORED: 'DOSSIER_RESTORED',
  WORKFLOW_STEP_COMPLETED: 'WORKFLOW_STEP_COMPLETED',
  WORKFLOW_TRANSITION_TRIGGERED: 'WORKFLOW_TRANSITION_TRIGGERED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  DOSSIER_DELETED: 'DOSSIER_DELETED',
  DOSSIER_PURGE_COMPLETED: 'DOSSIER_PURGE_COMPLETED',
} as const;

export const AuditActionSchema = z.enum([
  AUDIT_ACTIONS.DOCUMENT_INGESTED,
  AUDIT_ACTIONS.AI_ANALYSIS_COMPLETED,
  AUDIT_ACTIONS.USER_STATUS_OVERRIDE,
  AUDIT_ACTIONS.USER_NOTE_MODIFIED,
  AUDIT_ACTIONS.DOSSIER_APPENDED,
  AUDIT_ACTIONS.DOSSIER_ARCHIVED,
  AUDIT_ACTIONS.DOSSIER_RESTORED,
  AUDIT_ACTIONS.WORKFLOW_STEP_COMPLETED,
  AUDIT_ACTIONS.WORKFLOW_TRANSITION_TRIGGERED,
  AUDIT_ACTIONS.ACCESS_DENIED,
  AUDIT_ACTIONS.DOSSIER_DELETED,
  AUDIT_ACTIONS.DOSSIER_PURGE_COMPLETED,
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

export const AuditArchiveDetailsSchema = z.object({
  archiveStoragePath: z.string(),
  checksum: z.string(),
  vectorCount: z.number().int().nonnegative(),
});
export type AuditArchiveDetails = z.infer<typeof AuditArchiveDetailsSchema>;

export const AuditLogDetailsSchema = z
  .object({
    override: AuditOverrideDetailsSchema.optional(),
    sourceFingerprints: z.array(AuditSourceFingerprintSchema).optional(),
    archive: AuditArchiveDetailsSchema.optional(),
    note: z.string().optional(),
    caseTitle: z.string().optional(),
    actorRole: z.string().optional(),
    deniedAction: PermissionActionSchema.optional(),
    route: z.string().optional(),
    deletion: z
      .object({
        reason: DeletionReasonSchema,
        deletedRows: z.record(z.string(), z.number().int().nonnegative()),
        storageTasks: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .default({});

export type AuditLogDetails = z.infer<typeof AuditLogDetailsSchema>;

export const AuditLogEntrySchema = z.object({
  id: DbUuidSchema,
  organizationId: DbUuidSchema.nullable()
    .optional()
    .describe('Kanzlei-ID für strikte Mandantentrennung gem. § 203 StGB'),
  documentId: z.string().min(1),
  sequenceNumber: z.number().int().nonnegative(),
  action: AuditActionSchema,
  timestamp: z.iso.datetime(),
  actor: z.string().min(1),
  previousHash: z.string().min(1),
  currentHash: z.string().length(64),
  details: AuditLogDetailsSchema,
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const AuditIntegrityResultSchema = z.object({
  valid: z.boolean(),
  totalEntries: z.number().int().nonnegative(),
  brokenSequenceIndex: z.number().optional(),
  error: z.string().optional(),
});

export type AuditIntegrityResult = z.infer<typeof AuditIntegrityResultSchema>;
