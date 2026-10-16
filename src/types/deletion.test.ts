import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, AuditActionSchema } from './audit';
import { DELETION_REASONS, DeleteDossierRequestSchema, DeletionReceiptSchema } from './deletion';

describe('Löschverträge', () => {
  it('lehnt fehlenden und unbekannten Grund ab', () => {
    expect(DeleteDossierRequestSchema.safeParse({}).success).toBe(false);
    expect(DeleteDossierRequestSchema.safeParse({ reason: 'weil' }).success).toBe(false);
    expect(
      DeleteDossierRequestSchema.safeParse({ reason: DELETION_REASONS.ENTWURF_VERWORFEN }).success
    ).toBe(true);
  });

  it('lehnt negative Zählwerte im Nachweis ab', () => {
    const base = { documentId: 'd1', deletedRows: { documents: 1 }, storageTasks: 0 };
    expect(DeletionReceiptSchema.safeParse(base).success).toBe(true);
    expect(DeletionReceiptSchema.safeParse({ ...base, storageTasks: -1 }).success).toBe(false);
    expect(
      DeletionReceiptSchema.safeParse({ ...base, deletedRows: { documents: -1 } }).success
    ).toBe(false);
  });

  it('akzeptiert die neuen Audit-Ereignisse', () => {
    expect(AuditActionSchema.safeParse(AUDIT_ACTIONS.DOSSIER_DELETED).success).toBe(true);
    expect(AuditActionSchema.safeParse(AUDIT_ACTIONS.DOSSIER_PURGE_COMPLETED).success).toBe(true);
  });
});
