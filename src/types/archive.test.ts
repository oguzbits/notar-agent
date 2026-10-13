import { describe, it, expect } from 'vitest';
import {
  ARCHIVE_STATUS,
  ArchiveStatusSchema,
  buildDossierNamespace,
  DossierArchiveSnapshotSchema,
  DossierArchiveResultSchema,
  ArchiveDossierParamsSchema,
} from './archive';
import {
  CASE_TYPES,
  OVERALL_STATUS,
  FIELD_STATUS,
  CONTRIBUTION_TYPE,
  POWER_OF_REPRESENTATION,
} from './dossier';

describe('Dossier Archive & Namespace Contracts (src/types/archive.ts)', () => {
  it('validates canonical ArchiveStatusSchema values', () => {
    expect(ArchiveStatusSchema.safeParse(ARCHIVE_STATUS.ACTIVE).success).toBe(true);
    expect(ArchiveStatusSchema.safeParse(ARCHIVE_STATUS.ARCHIVED).success).toBe(true);
    expect(ArchiveStatusSchema.safeParse('UNKNOWN').success).toBe(false);
  });

  it('builds deterministic dossier namespace', () => {
    expect(buildDossierNamespace('case-123')).toBe('dossier:case-123');
  });

  it('validates ArchiveDossierParamsSchema', () => {
    const validParams = {
      dossierId: 'case-123',
      organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      actor: 'Notar Dr. Mustermann',
      reason: 'Beurkundung vollzogen gem. § 17 BeurkG',
    };
    const res = ArchiveDossierParamsSchema.safeParse(validParams);
    if (!res.success) console.log('ArchiveDossierParamsSchema Error:', res.error);
    expect(res.success).toBe(true);

    const invalidUuid = { ...validParams, organizationId: 'not-a-uuid' };
    expect(ArchiveDossierParamsSchema.safeParse(invalidUuid).success).toBe(false);

    const shortReason = { ...validParams, reason: 'ok' };
    expect(ArchiveDossierParamsSchema.safeParse(shortReason).success).toBe(false);
  });

  it('validates DossierArchiveSnapshotSchema with full payload', () => {
    const validGmbhDossier = {
      caseType: CASE_TYPES.GMBH_GRUENDUNG,
      caseTitle: 'Gründung Muster GmbH',
      analysisTimestamp: '2026-10-13T18:00:00.000Z',
      detectedDocuments: [],
      inquiries: [],
      overallStatus: OVERALL_STATUS.READY,
      executiveSummary: 'Gründungsunterlagen vollständig.',
      fields: {
        firma: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            companyName: 'Muster Innovations GmbH',
            hasNameCheckIhk: true,
            seatCity: 'Frankfurt am Main',
          },
          source: { fileName: 'IHK_Bestaetigung.pdf', pageNumber: 1, snippet: 'Name zulässig' },
          note: '',
        },
        gesellschafter: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            partners: [
              { name: 'Dr. Anna Schmidt', shareAmount: 15000, sharePercent: 60 },
              { name: 'Max Mustermann', shareAmount: 10000, sharePercent: 40 },
            ],
            totalCapital: 25000,
          },
          source: { fileName: 'Gruendungsprotokoll.pdf', pageNumber: 1, snippet: 'Gesellschafter' },
          note: '',
        },
        geschaeftsfuehrer: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            managingDirectors: [
              {
                name: 'Dr. Anna Schmidt',
                powerOfRepresentation: POWER_OF_REPRESENTATION.EINZELVERTRETUNG,
                exemption181Bgb: true,
              },
            ],
            criminalRecordCheckPassed: true,
          },
          source: { fileName: 'Ausweis.pdf', pageNumber: 1, snippet: 'GF Benennung' },
          note: '',
        },
        stammkapital: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            nominalCapital: 25000,
            contributionType: CONTRIBUTION_TYPE.BAREINLAGE,
            minimumDepositPaid: true,
          },
          source: { fileName: 'Bankbeleg.pdf', pageNumber: 1, snippet: 'Einzahlung 25.000 EUR' },
          note: '',
        },
        unternehmensgegenstand: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            purposeDescription: 'Softwareentwicklung und IT-Beratung',
            requiresSpecialPermit: false,
          },
          source: { fileName: 'Entwurf_Satzung.pdf', pageNumber: 1, snippet: 'Zweck' },
          note: '',
        },
      },
    };

    const validSnapshot = {
      snapshotVersion: 1,
      dossierId: 'case-123',
      organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      caseTitle: 'Gründung Muster GmbH',
      caseType: CASE_TYPES.GMBH_GRUENDUNG,
      archivedAt: '2026-10-13T18:00:00.000Z',
      archivedBy: 'Notar Dr. Mustermann',
      reason: 'Beurkundungsverfahren abgeschlossen',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      dossierContent: validGmbhDossier,
      knowledgeChunks: [
        {
          id: 'chunk-1',
          title: 'Auszug Satzung',
          content: 'Das Stammkapital beträgt 25.000 EUR...',
          category: 'DOSSIER_CONTEXT',
          legalBasis: 'dossier:case-123',
        },
      ],
      fileManifest: [
        {
          name: 'kaufvertrag.pdf',
          storagePath: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/kaufvertrag.pdf',
          size: 102400,
        },
      ],
    };

    const parsed = DossierArchiveSnapshotSchema.safeParse(validSnapshot);
    expect(parsed.success).toBe(true);
  });

  it('validates DossierArchiveResultSchema', () => {
    const validResult = {
      dossierId: 'case-123',
      organizationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      archiveStoragePath: 'archive/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/case-123/snapshot.json',
      archivedAt: '2026-10-13T18:00:00.000Z',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      purgedVectorCount: 14,
      status: ARCHIVE_STATUS.ARCHIVED,
    };

    expect(DossierArchiveResultSchema.safeParse(validResult).success).toBe(true);
  });
});
