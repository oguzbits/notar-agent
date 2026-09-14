import { describe, it, expect } from 'vitest';
import {
  AUDIT_ACTIONS,
  AuditLogEntrySchema,
  AuditOverrideDetailsSchema,
  AuditSourceFingerprintSchema,
} from './audit';
import { FIELD_STATUS } from './dossier';

describe('Audit Types & Zod Schemas (§ 17 ff. BeurkG)', () => {
  it('validates a correct AuditSourceFingerprint', () => {
    const validFingerprint = {
      fileName: 'grundbuchauszug.pdf',
      sha256: 'a'.repeat(64),
      sizeBytes: 1048576,
    };
    const parsed = AuditSourceFingerprintSchema.safeParse(validFingerprint);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid sha256 hash length in fingerprint', () => {
    const invalidFingerprint = {
      fileName: 'test.pdf',
      sha256: 'too-short',
      sizeBytes: 500,
    };
    const parsed = AuditSourceFingerprintSchema.safeParse(invalidFingerprint);
    expect(parsed.success).toBe(false);
  });

  it('validates status override details and enforces min length for justification reason', () => {
    const validOverride = {
      fieldKey: 'verkaeufer',
      fieldTitle: 'Verkäufer',
      previousStatus: FIELD_STATUS.NEEDS_REVIEW,
      newStatus: FIELD_STATUS.VERIFIED,
      reason: 'Erbschein nach § 35 GBO lag zur Einsichtnahme vor',
    };
    const parsed = AuditOverrideDetailsSchema.safeParse(validOverride);
    expect(parsed.success).toBe(true);

    const invalidOverride = {
      ...validOverride,
      reason: 'ok', // too short (< 3 chars)
    };
    const invalidParsed = AuditOverrideDetailsSchema.safeParse(invalidOverride);
    expect(invalidParsed.success).toBe(false);
  });

  it('validates a complete hash-chained AuditLogEntry', () => {
    const entry = {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      documentId: 'doc-1234',
      sequenceNumber: 1,
      action: AUDIT_ACTIONS.USER_STATUS_OVERRIDE,
      timestamp: new Date().toISOString(),
      actor: 'Notarfachangestellte(r)',
      previousHash: '0'.repeat(64),
      currentHash: 'f'.repeat(64),
      details: {
        override: {
          fieldKey: 'kaeufer',
          previousStatus: FIELD_STATUS.NEEDS_REVIEW,
          newStatus: FIELD_STATUS.VERIFIED,
          reason: 'Handelsregisterauszug HRB 99123 geprüft',
        },
      },
    };
    const parsed = AuditLogEntrySchema.safeParse(entry);
    expect(parsed.success).toBe(true);
  });
});
