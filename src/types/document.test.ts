import { describe, it, expect } from 'vitest';
import {
  CASE_STATUS,
  CaseStatusSchema,
  DocumentListItemSchema,
  DocumentRecordSchema,
  DocumentParsedContentSchema,
} from './document';
import {
  CASE_TYPES,
  OVERALL_STATUS,
  FIELD_STATUS,
  CONTRIBUTION_TYPE,
  POWER_OF_REPRESENTATION,
} from './dossier';

describe('Document Domain Contract & Schemas', () => {
  it('validates CaseStatusSchema against canonical CASE_STATUS dictionary', () => {
    expect(CaseStatusSchema.safeParse(CASE_STATUS.IN_PROGRESS).success).toBe(true);
    expect(CaseStatusSchema.safeParse(CASE_STATUS.DRAFT_READY).success).toBe(true);
    expect(CaseStatusSchema.safeParse('Unbekannt').success).toBe(false);
  });

  it('validates DocumentListItemSchema structure for lightweight projections', () => {
    const validListItem = {
      id: 'doc-123',
      title: 'Muster-Kaufvertrag',
      status: CASE_STATUS.IN_PROGRESS,
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
    };

    const parsed = DocumentListItemSchema.safeParse(validListItem);
    expect(parsed.success).toBe(true);

    const withoutOptionalFields = {
      id: 'doc-456',
      title: 'Ohne CaseType',
      status: CASE_STATUS.DRAFT_READY,
      created_at: new Date().toISOString(),
    };
    expect(DocumentListItemSchema.safeParse(withoutOptionalFields).success).toBe(true);

    const invalid = {
      id: '',
      title: 'Invalid',
      status: CASE_STATUS.IN_PROGRESS,
      created_at: new Date().toISOString(),
    };
    expect(DocumentListItemSchema.safeParse(invalid).success).toBe(false);
  });

  it('validates DocumentRecordSchema structure', () => {
    const validRecord = {
      id: 'doc-123',
      title: 'Muster-Kaufvertrag',
      status: CASE_STATUS.IN_PROGRESS,
      content: {
        caseType: CASE_TYPES.GMBH_GRUENDUNG,
        caseTitle: 'Gründung Muster GmbH',
        analysisTimestamp: new Date().toISOString(),
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
            source: { fileName: 'IHK.pdf', pageNumber: 1, snippet: 'Name zulässig' },
            note: '',
          },
          gesellschafter: {
            status: FIELD_STATUS.VERIFIED,
            data: {
              partners: [{ name: 'Dr. Anna Schmidt', shareAmount: 25000, sharePercent: 100 }],
              totalCapital: 25000,
            },
            source: { fileName: 'Protokoll.pdf', pageNumber: 1, snippet: 'Gesellschafter' },
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
            source: { fileName: 'Ausweis.pdf', pageNumber: 1, snippet: 'GF' },
            note: '',
          },
          stammkapital: {
            status: FIELD_STATUS.VERIFIED,
            data: {
              nominalCapital: 25000,
              contributionType: CONTRIBUTION_TYPE.BAREINLAGE,
              minimumDepositPaid: true,
            },
            source: { fileName: 'Bankbeleg.pdf', pageNumber: 1, snippet: '25.000 EUR' },
            note: '',
          },
          unternehmensgegenstand: {
            status: FIELD_STATUS.VERIFIED,
            data: {
              purposeDescription: 'IT-Beratung',
              requiresSpecialPermit: false,
            },
            source: { fileName: 'Satzung.pdf', pageNumber: 1, snippet: 'Zweck' },
            note: '',
          },
        },
      },
      created_at: new Date().toISOString(),
    };

    const parsed = DocumentRecordSchema.safeParse(validRecord);
    expect(parsed.success).toBe(true);
  });

  it('rejects DocumentRecord with invalid case status', () => {
    const invalidRecord = {
      id: 'doc-123',
      title: 'Muster-Kaufvertrag',
      status: 'INVALID_STATUS',
      content: {},
      created_at: new Date().toISOString(),
    };

    const parsed = DocumentRecordSchema.safeParse(invalidRecord);
    expect(parsed.success).toBe(false);
  });

  it('validates DocumentParsedContentSchema contract', () => {
    const validParsedContent = {
      markdown: '# Urkunde § 1\n\nKaufpreis: 500.000 EUR',
      totalPages: 1,
      blocks: [
        {
          pageNumber: 1,
          type: 'heading',
          content: 'Urkunde § 1',
          bbox: { x: 50, y: 700, width: 200, height: 20 },
        },
      ],
      characterCount: 35,
      hasTextLayer: true,
      needsOcr: false,
      metadata: { creator: 'NoRA Advanced', producer: 'PDF-Engine' },
    };

    const parsed = DocumentParsedContentSchema.safeParse(validParsedContent);
    expect(parsed.success).toBe(true);

    const withHash = DocumentParsedContentSchema.safeParse({
      ...validParsedContent,
      contentHash: 'a'.repeat(64),
    });
    expect(withHash.success).toBe(true);
    if (withHash.success) {
      expect(withHash.data.contentHash).toBe('a'.repeat(64));
    }

    const invalidHash = DocumentParsedContentSchema.safeParse({
      ...validParsedContent,
      contentHash: 'short',
    });
    expect(invalidHash.success).toBe(false);
  });
});
