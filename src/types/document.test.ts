import { describe, it, expect } from 'vitest';
import { CASE_STATUS, CaseStatusSchema, DocumentRecordSchema } from './document';
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
});
