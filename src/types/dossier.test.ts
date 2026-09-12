import { describe, it, expect } from 'vitest';
import {
  CaseTypeSchema,
  GmbhDossierSchema,
  DossierSchema,
  isImmobilienDossier,
  isGmbhDossier,
  Dossier,
} from './dossier';

describe('Dossier Discriminated Union & Case Schemas', () => {
  it('should validate CaseTypeSchema containing IMMOBILIENKAUF and GMBH_GRUENDUNG', () => {
    expect(CaseTypeSchema.safeParse('IMMOBILIENKAUF').success).toBe(true);
    expect(CaseTypeSchema.safeParse('GMBH_GRUENDUNG').success).toBe(true);
    expect(CaseTypeSchema.safeParse('INVALID').success).toBe(false);
  });

  it('should parse valid GmbhDossier and discriminate correctly', () => {
    const validGmbhPayload = {
      caseType: 'GMBH_GRUENDUNG' as const,
      caseTitle: 'Gründung Muster GmbH',
      analysisTimestamp: new Date().toISOString(),
      detectedDocuments: [],
      inquiries: [],
      overallStatus: 'READY' as const,
      executiveSummary: 'Gründungsunterlagen vollständig.',
      fields: {
        firma: {
          status: 'VERIFIED' as const,
          data: {
            companyName: 'Muster Innovations GmbH',
            hasNameCheckIhk: true,
            seatCity: 'Frankfurt am Main',
          },
          source: { fileName: 'IHK_Bestaetigung.pdf', pageNumber: 1, snippet: 'Name zulässig' },
          note: '',
        },
        gesellschafter: {
          status: 'VERIFIED' as const,
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
          status: 'VERIFIED' as const,
          data: {
            managingDirectors: [
              {
                name: 'Dr. Anna Schmidt',
                powerOfRepresentation: 'EINZELVERTRETUNG',
                exemption181Bgb: true,
              },
            ],
            criminalRecordCheckPassed: true,
          },
          source: { fileName: 'Ausweis.pdf', pageNumber: 1, snippet: 'GF Benennung' },
          note: '',
        },
        stammkapital: {
          status: 'VERIFIED' as const,
          data: {
            nominalCapital: 25000,
            contributionType: 'BAREINLAGE' as const,
            minimumDepositPaid: true,
          },
          source: { fileName: 'Bankbeleg.pdf', pageNumber: 1, snippet: 'Einzahlung 25.000 EUR' },
          note: '',
        },
        unternehmensgegenstand: {
          status: 'VERIFIED' as const,
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
      overallStatus: 'READY',
      executiveSummary: '',
      fields: {},
    };

    const parsed = DossierSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });
});
