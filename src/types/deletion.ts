import { z } from 'zod';

export const DELETION_REASONS = {
  ENTWURF_VERWORFEN: 'ENTWURF_VERWORFEN',
  FEHLERHAFT_ANGELEGT: 'FEHLERHAFT_ANGELEGT',
  AUFBEWAHRUNG_ABGELAUFEN: 'AUFBEWAHRUNG_ABGELAUFEN',
  SONSTIGES: 'SONSTIGES',
} as const;

export const DeletionReasonSchema = z.enum([
  DELETION_REASONS.ENTWURF_VERWORFEN,
  DELETION_REASONS.FEHLERHAFT_ANGELEGT,
  DELETION_REASONS.AUFBEWAHRUNG_ABGELAUFEN,
  DELETION_REASONS.SONSTIGES,
]);
export type DeletionReason = z.infer<typeof DeletionReasonSchema>;

export const DELETION_TASK_STATUS = {
  PENDING: 'PENDING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;
export type DeletionTaskStatus = (typeof DELETION_TASK_STATUS)[keyof typeof DELETION_TASK_STATUS];

export const DeleteDossierRequestSchema = z.object({ reason: DeletionReasonSchema });
export type DeleteDossierRequest = z.infer<typeof DeleteDossierRequestSchema>;

export const DeletionReceiptSchema = z.object({
  documentId: z.string().min(1),
  deletedRows: z.record(z.string(), z.number().int().nonnegative()),
  storageTasks: z.number().int().nonnegative(),
});
export type DeletionReceipt = z.infer<typeof DeletionReceiptSchema>;
