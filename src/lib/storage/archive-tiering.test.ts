import stringify from 'fast-json-stable-stringify';
import { describe, it, expect, vi } from 'vitest';
import { calculateFileFingerprint } from '@/lib/audit/audit-crypto';
import { ARCHIVE_STATUS } from '@/types/archive';
import { AUDIT_ACTIONS } from '@/types/audit';
import { DB_TABLES } from '@/types/database';
import { CASE_STATUS } from '@/types/document';
import {
  CASE_TYPES,
  OVERALL_STATUS,
  FIELD_STATUS,
  CONTRIBUTION_TYPE,
  POWER_OF_REPRESENTATION,
  DOCUMENT_RELIABILITY,
} from '@/types/dossier';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';
import {
  isDossierEligibleForArchival,
  archiveDossierToColdStorage,
  restoreDossierFromColdStorage,
} from './archive-tiering';

const orgId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const dossierId = 'case-test-42';

const validGmbhDossier = {
  caseType: CASE_TYPES.GMBH_GRUENDUNG,
  caseTitle: 'Gründung Alpha GmbH',
  analysisTimestamp: '2026-10-13T18:00:00.000Z',
  detectedDocuments: [
    {
      fileName: 'gruendung.pdf',
      documentType: 'GRUNDBUCHAUSZUG',
      date: '2026-10-10',
      pageCount: 12,
      reliability: DOCUMENT_RELIABILITY.HIGH,
    },
  ],
  inquiries: [],
  overallStatus: OVERALL_STATUS.READY,
  executiveSummary: 'Gründungsunterlagen vollständig geprüft.',
  fields: {
    firma: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        companyName: 'Alpha Innovations GmbH',
        hasNameCheckIhk: true,
        seatCity: 'Frankfurt am Main',
      },
      source: { fileName: 'gruendung.pdf', pageNumber: 1, snippet: 'Firma Alpha' },
      note: '',
    },
    gesellschafter: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        partners: [{ name: 'Anna Schmidt', shareAmount: 25000, sharePercent: 100 }],
        totalCapital: 25000,
      },
      source: { fileName: 'gruendung.pdf', pageNumber: 1, snippet: 'Gesellschafter' },
      note: '',
    },
    geschaeftsfuehrer: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        managingDirectors: [
          {
            name: 'Anna Schmidt',
            powerOfRepresentation: POWER_OF_REPRESENTATION.EINZELVERTRETUNG,
            exemption181Bgb: true,
          },
        ],
        criminalRecordCheckPassed: true,
      },
      source: { fileName: 'gruendung.pdf', pageNumber: 1, snippet: 'Geschäftsführer' },
      note: '',
    },
    stammkapital: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        nominalCapital: 25000,
        contributionType: CONTRIBUTION_TYPE.BAREINLAGE,
        minimumDepositPaid: true,
      },
      source: { fileName: 'gruendung.pdf', pageNumber: 1, snippet: 'Stammkapital 25.000' },
      note: '',
    },
    unternehmensgegenstand: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        purposeDescription: 'Softwareentwicklung und Beratung',
        requiresSpecialPermit: false,
      },
      source: { fileName: 'gruendung.pdf', pageNumber: 1, snippet: 'Gegenstand' },
      note: '',
    },
  },
};

describe('Cold-Data-Archiv-Tiering & Isolation (src/lib/storage/archive-tiering.ts)', () => {
  it('correctly checks eligibility for archival', () => {
    expect(isDossierEligibleForArchival(CASE_STATUS.DRAFT_READY)).toBe(true);
    expect(isDossierEligibleForArchival(CASE_STATUS.IN_PROGRESS)).toBe(false);
  });

  it('archives dossier to cold storage, purges active vectors, and logs audit trail', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: 'snapshot.json' }, error: null });
    const mockStorageFrom = vi.fn().mockReturnValue({ upload: mockUpload });

    const mockKnowledgeDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null, count: 5 }),
      }),
    });

    const mockAuditInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            document_id: dossierId,
            sequence_number: 1,
            action: AUDIT_ACTIONS.DOSSIER_ARCHIVED,
            timestamp: new Date().toISOString(),
            actor: 'Notar Dr. Mustermann',
            previous_hash: '0'.repeat(64),
            current_hash: '1'.repeat(64),
            details: {},
          },
          error: null,
        }),
      }),
    });

    const mockDocumentSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: dossierId,
              organization_id: orgId,
              title: 'Gründung Alpha GmbH',
              status: CASE_STATUS.DRAFT_READY,
              content: validGmbhDossier,
              created_at: '2026-10-10T10:00:00.000Z',
              updated_at: '2026-10-13T10:00:00.000Z',
            },
            error: null,
          }),
        }),
      }),
    });

    const mockKnowledgeSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'k-1',
              title: 'Gründungsklausel',
              content: 'Stammkapital 25.000 EUR',
              category: 'DOSSIER_CONTEXT',
              legal_basis: `dossier:${dossierId}`,
            },
          ],
          error: null,
        }),
      }),
    });

    const mockDocumentUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const mockAuditSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === DB_TABLES.DOCUMENTS) {
          return {
            select: mockDocumentSelect,
            update: mockDocumentUpdate,
          };
        }
        if (table === DB_TABLES.KNOWLEDGE_DOCUMENTS) {
          return {
            select: mockKnowledgeSelect,
            delete: mockKnowledgeDelete,
          };
        }
        if (table === DB_TABLES.AUDIT_LOGS) {
          return {
            select: mockAuditSelect,
            insert: mockAuditInsert,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: mockStorageFrom,
      },
    };

    const result = await archiveDossierToColdStorage(mockSupabase as never, {
      dossierId,
      organizationId: orgId,
      actor: 'Notar Dr. Mustermann',
      reason: 'Beurkundung vollzogen gem. § 17 BeurkG',
    });

    expect(result.dossierId).toBe(dossierId);
    expect(result.organizationId).toBe(orgId);
    expect(result.status).toBe(ARCHIVE_STATUS.ARCHIVED);
    expect(result.purgedVectorCount).toBe(1);
    expect(result.checksum).toBeDefined();

    // Verify snapshot upload to cold tier
    expect(mockStorageFrom).toHaveBeenCalledWith(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining(`${orgId}/archive/${dossierId}/`),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/json' })
    );

    // Verify vector purge to prevent pgvector cache pollution
    expect(mockKnowledgeDelete).toHaveBeenCalled();

    // Verify audit trail append
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: dossierId,
        action: AUDIT_ACTIONS.DOSSIER_ARCHIVED,
        actor: 'Notar Dr. Mustermann',
      })
    );
  });

  it('restores dossier snapshot from cold storage and verifies checksum integrity', async () => {
    const canonicalJson = stringify(validGmbhDossier);
    const checksum = calculateFileFingerprint(canonicalJson);

    const snapshotPayload = {
      snapshotVersion: 1,
      dossierId,
      organizationId: orgId,
      caseTitle: 'Gründung Alpha GmbH',
      caseType: CASE_TYPES.GMBH_GRUENDUNG,
      archivedAt: '2026-10-13T18:00:00.000Z',
      archivedBy: 'Notar Dr. Mustermann',
      reason: 'Beurkundungsverfahren abgeschlossen',
      checksum,
      dossierContent: validGmbhDossier,
      knowledgeChunks: [
        {
          id: 'k-1',
          title: 'Gründungsklausel',
          content: 'Stammkapital 25.000 EUR',
          category: 'DOSSIER_CONTEXT',
          legalBasis: `dossier:${dossierId}`,
        },
      ],
      fileManifest: [
        {
          name: 'gruendung.pdf',
          storagePath: `${orgId}/gruendung.pdf`,
          size: 10240,
        },
      ],
    };

    const mockDownload = vi.fn().mockResolvedValue({
      data: {
        text: async () => JSON.stringify(snapshotPayload),
      },
      error: null,
    });

    const mockStorageFrom = vi.fn().mockReturnValue({ download: mockDownload });
    const mockAuditInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            document_id: dossierId,
            sequence_number: 1,
            action: AUDIT_ACTIONS.DOSSIER_RESTORED,
            timestamp: new Date().toISOString(),
            actor: 'Notar Dr. Mustermann',
            previous_hash: '0'.repeat(64),
            current_hash: '1'.repeat(64),
            details: {},
          },
          error: null,
        }),
      }),
    });
    const mockKnowledgeInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockAuditSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === DB_TABLES.KNOWLEDGE_DOCUMENTS) {
          return { insert: mockKnowledgeInsert };
        }
        if (table === DB_TABLES.AUDIT_LOGS) {
          return {
            select: mockAuditSelect,
            insert: mockAuditInsert,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      storage: {
        from: mockStorageFrom,
      },
    };

    const restored = await restoreDossierFromColdStorage(mockSupabase as never, {
      dossierId,
      organizationId: orgId,
      actor: 'Notar Dr. Mustermann',
      reason: 'Wiederaufnahme zur Nachbeurkundung',
      archiveStoragePath: `${orgId}/archive/${dossierId}/snapshot.json`,
    });

    expect(restored.dossierId).toBe(dossierId);
    expect(restored.checksum).toBe(checksum);
    expect(mockKnowledgeInsert).toHaveBeenCalled();
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: dossierId,
        action: AUDIT_ACTIONS.DOSSIER_RESTORED,
      })
    );
  });

  it('rejects restoration if archive checksum is corrupted', async () => {
    const snapshotPayload = {
      snapshotVersion: 1,
      dossierId,
      organizationId: orgId,
      caseTitle: 'Gründung Alpha GmbH',
      caseType: CASE_TYPES.GMBH_GRUENDUNG,
      archivedAt: '2026-10-13T18:00:00.000Z',
      archivedBy: 'Notar Dr. Mustermann',
      reason: 'Beurkundungsverfahren abgeschlossen',
      checksum: '0000000000000000000000000000000000000000000000000000000000000000', // invalid
      dossierContent: validGmbhDossier,
      knowledgeChunks: [],
      fileManifest: [],
    };

    const mockDownload = vi.fn().mockResolvedValue({
      data: {
        text: async () => JSON.stringify(snapshotPayload),
      },
      error: null,
    });

    const mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({ download: mockDownload }),
      },
      from: vi.fn(),
    };

    await expect(
      restoreDossierFromColdStorage(mockSupabase as never, {
        dossierId,
        organizationId: orgId,
        actor: 'Notar Dr. Mustermann',
        reason: 'Wiederaufnahme',
        archiveStoragePath: `${orgId}/archive/${dossierId}/snapshot.json`,
      })
    ).rejects.toThrow('Integritätsprüfung fehlgeschlagen');
  });
});
