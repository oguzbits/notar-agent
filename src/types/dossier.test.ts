import { describe, it, expect } from 'vitest';
import {
  CaseTypeSchema,
  GmbhDossierSchema,
  DossierSchema,
  isImmobilienDossier,
  isGmbhDossier,
  Dossier,
  CASE_TYPES,
  OVERALL_STATUS,
  FIELD_STATUS,
  CONTRIBUTION_TYPE,
  POWER_OF_REPRESENTATION,
} from './dossier';

describe('Dossier Discriminated Union & Case Schemas', () => {
  it('should validate CaseTypeSchema containing IMMOBILIENKAUF and GMBH_GRUENDUNG', () => {
    expect(CaseTypeSchema.safeParse(CASE_TYPES.IMMOBILIENKAUF).success).toBe(true);
    expect(CaseTypeSchema.safeParse(CASE_TYPES.GMBH_GRUENDUNG).success).toBe(true);
    expect(CaseTypeSchema.safeParse('INVALID').success).toBe(false);
  });

  it('should parse valid GmbhDossier and discriminate correctly', () => {
    const validGmbhPayload = {
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

    const parsedGmbh = GmbhDossierSchema.safeParse(validGmbhPayload);
    expect(parsedGmbh.success).toBe(true);

    const parsedUnion = DossierSchema.safeParse(validGmbhPayload);
    expect(parsedUnion.success).toBe(true);

    if (parsedUnion.success) {
      const dossier: Dossier = parsedUnion.data;
      expect(isGmbhDossier(dossier)).toBe(true);
      expect(isImmobilienDossier(dossier)).toBe(false);
      if (isGmbhDossier(dossier)) {
        expect(dossier.fields.stammkapital.data.nominalCapital).toBe(25000);
      }
    }
  });

  it('should reject invalid caseType or payload mismatch in discriminated union', () => {
    const invalidPayload = {
      caseType: 'UNKNOWN_TYPE',
      caseTitle: 'Test',
      analysisTimestamp: new Date().toISOString(),
      detectedDocuments: [],
      inquiries: [],
      overallStatus: OVERALL_STATUS.READY,
      executiveSummary: '',
      fields: {},
    };

    const parsed = DossierSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });
});
