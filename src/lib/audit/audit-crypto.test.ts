import { describe, it, expect } from 'vitest';
import { AUDIT_ACTIONS, AuditLogEntry } from '@/types/audit';
import {
  calculateAuditRecordHash,
  calculateFileFingerprint,
  GENESIS_HASH,
  verifyAuditChain,
} from './audit-crypto';

describe('Audit Crypto & Hash Chaining (§ 17 ff. BeurkG)', () => {
  it('calculates deterministic SHA-256 fingerprint for document contents', () => {
    const hash1 = calculateFileFingerprint('Kaufvertragsentwurf 120.000 €');
    const hash2 = calculateFileFingerprint('Kaufvertragsentwurf 120.000 €');
    const hash3 = calculateFileFingerprint('Kaufvertragsentwurf 120.001 €');

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(hash3);
  });

  it('verifies a valid unbroken chain of audit events', () => {
    const time0 = new Date('2026-09-14T08:00:00Z').toISOString();
    const hash0 = calculateAuditRecordHash({
      documentId: 'doc-1',
      sequenceNumber: 0,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      timestamp: time0,
      actor: 'System Ingestion',
      previousHash: GENESIS_HASH,
      details: { caseTitle: 'Kaufvertrag Müller / Schmidt' },
    });

    const entry0: AuditLogEntry = {
      id: '00000000-0000-0000-0000-000000000001',
      documentId: 'doc-1',
      sequenceNumber: 0,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      timestamp: time0,
      actor: 'System Ingestion',
      previousHash: GENESIS_HASH,
      currentHash: hash0,
      details: { caseTitle: 'Kaufvertrag Müller / Schmidt' },
    };

    const time1 = new Date('2026-09-14T08:05:00Z').toISOString();
    const hash1 = calculateAuditRecordHash({
      documentId: 'doc-1',
      sequenceNumber: 1,
      action: AUDIT_ACTIONS.AI_ANALYSIS_COMPLETED,
      timestamp: time1,
      actor: 'AI Notary Auditor',
      previousHash: hash0,
      details: {},
    });

    const entry1: AuditLogEntry = {
      id: '00000000-0000-0000-0000-000000000002',
      documentId: 'doc-1',
      sequenceNumber: 1,
      action: AUDIT_ACTIONS.AI_ANALYSIS_COMPLETED,
      timestamp: time1,
      actor: 'AI Notary Auditor',
      previousHash: hash0,
      currentHash: hash1,
      details: {},
    };

    const result = verifyAuditChain([entry0, entry1]);
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(2);
  });

  it('detects tampering when an audit entry was illegally altered', () => {
    const time0 = new Date('2026-09-14T08:00:00Z').toISOString();
    const hash0 = calculateAuditRecordHash({
      documentId: 'doc-1',
      sequenceNumber: 0,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      timestamp: time0,
      actor: 'System Ingestion',
      previousHash: GENESIS_HASH,
      details: {},
    });

    const entry0: AuditLogEntry = {
      id: '00000000-0000-0000-0000-000000000001',
      documentId: 'doc-1',
      sequenceNumber: 0,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      timestamp: time0,
      actor: 'System Ingestion',
      previousHash: GENESIS_HASH,
      currentHash: hash0,
      details: {},
    };

    // Böswillige Manipulation: Jemand ändert den actor im Speicher
    const tamperedEntry = {
      ...entry0,
      actor: 'Unbefugter Dritter',
    };

    const verification = verifyAuditChain([tamperedEntry]);
    expect(verification.valid).toBe(false);
    expect(verification.brokenSequenceIndex).toBe(0);
    expect(verification.error).toContain('Datenmanipulation');
  });

  it('detects broken hash pointer between consecutive entries', () => {
    const time0 = new Date('2026-09-14T08:00:00Z').toISOString();
    const hash0 = calculateAuditRecordHash({
      documentId: 'doc-1',
      sequenceNumber: 0,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      timestamp: time0,
      actor: 'System',
      previousHash: GENESIS_HASH,
      details: {},
    });

    const entry0: AuditLogEntry = {
      id: '00000000-0000-0000-0000-000000000001',
      documentId: 'doc-1',
      sequenceNumber: 0,
      action: AUDIT_ACTIONS.DOCUMENT_INGESTED,
      timestamp: time0,
      actor: 'System',
      previousHash: GENESIS_HASH,
      currentHash: hash0,
      details: {},
    };

    const time1 = new Date('2026-09-14T08:01:00Z').toISOString();
    // Entry1 zeigt fälschlicherweise nicht auf hash0
    const wrongPrevHash = 'e'.repeat(64);
    const hash1 = calculateAuditRecordHash({
      documentId: 'doc-1',
      sequenceNumber: 1,
      action: AUDIT_ACTIONS.USER_NOTE_MODIFIED,
      timestamp: time1,
      actor: 'Notar',
      previousHash: wrongPrevHash,
      details: {},
    });

    const entry1: AuditLogEntry = {
      id: '00000000-0000-0000-0000-000000000002',
      documentId: 'doc-1',
      sequenceNumber: 1,
      action: AUDIT_ACTIONS.USER_NOTE_MODIFIED,
      timestamp: time1,
      actor: 'Notar',
      previousHash: wrongPrevHash,
      currentHash: hash1,
      details: {},
    };

    const verification = verifyAuditChain([entry0, entry1]);
    expect(verification.valid).toBe(false);
    expect(verification.brokenSequenceIndex).toBe(1);
    expect(verification.error).toContain('Kettenbruch');
  });
});
