import { describe, it, expect } from 'vitest';
import { Dossier, FieldStatus, ImmobilienFields } from '@/types/dossier';
import { isDossierEntwurfsreif, getDossierReadinessStage } from './readiness';

function createMockDossier(
  fieldStatusMap: Partial<Record<keyof ImmobilienFields, FieldStatus>> = {}
): Dossier {
  const defaultFields: ImmobilienFields = {
    verkaeufer: {
      status: 'VERIFIED',
      data: {
        name: 'Musterverkäufer',
        legalForm: 'natürliche Person',
        registeredOwnersGrundbuch: ['Musterverkäufer'],
        authorizedRepresentatives: [],
        representationProofProvided: true,
        missingProofs: [],
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'V' },
      note: '',
    },
    kaeufer: {
      status: 'VERIFIED',
      data: {
        companyName: 'Musterkäufer GmbH',
        legalForm: 'GmbH',
        registerCourt: 'Amtsgericht Musterstadt',
        registerNumber: 'HRB 1234',
        address: 'Musterstraße 1',
        authorizedRepresentatives: ['Max Mustermann'],
        hasOfficialRegisterProof: true,
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'K' },
      note: '',
    },
    grundbuch: {
      status: 'VERIFIED',
      data: {
        blatt: '1234',
        amtsgericht: 'Amtsgericht Musterstadt',
        grundbuchBezirk: 'Musterbezirk',
        standDatum: '2026-01-01',
        isCurrent: true,
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'G' },
      note: '',
    },
    grundstuecke: {
      status: 'VERIFIED',
      data: {
        parcels: [
          {
            flurstueckNummer: '1',
            gemarkung: 'Muster',
            flur: '1',
            wirtschaftsart: 'Gebäude',
            sizeM2: 500,
          },
        ],
        totalAreaM2: 500,
        areaDiscrepancyNotes: '',
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'Flur' },
      note: '',
    },
    kaufpreis: {
      status: 'VERIFIED',
      data: {
        amountInFigures: 100000,
        amountInWords: 'Einhunderttausend Euro',
        currency: 'EUR',
        previousOffers: [],
        priceEvolutionSummary: '',
        isFinalAgreedPrice: true,
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'P' },
      note: '',
    },
    finanzierung: {
      status: 'VERIFIED',
      data: {
        lenderName: 'Musterbank',
        mortgageAmount: 80000,
        requiresFinancingPowerOfAttorney: false,
        interestRateAndPawnDetails: '',
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'Fin' },
      note: '',
    },
    belastungen: {
      status: 'VERIFIED',
      data: { entries: [], clearingRequirements: [] },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'Bel' },
      note: '',
    },
    mietverhaeltnisse: {
      status: 'VERIFIED',
      data: {
        yearlyNetRent: 12000,
        statedInEmailOrOverview: 'Mietaufstellung',
        rentableAreaM2: 100,
        unitCount: 1,
        fullRentedStatus: true,
        tenancyListAvailable: true,
        privacyOrRedactionNotes: '',
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'Miet' },
      note: '',
    },
    energieausweis: {
      status: 'VERIFIED',
      data: {
        efficiencyClass: 'B',
        certificateType: 'VERBRAUCHSAUSWEIS',
        energyValueKWh: 60,
        validUntil: '2030-01-01',
        isExpired: false,
        primaryEnergyCarrier: 'Gas',
        buildingYear: '2000',
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'En' },
      note: '',
    },
    uebergabe: {
      status: 'VERIFIED',
      data: {
        targetDate: '2026-12-01',
        conditionDescription: 'Nach Kaufpreiszahlung',
        riskTransferNotes: 'Nutzen und Lasten ab Übergabe',
      },
      source: { fileName: 'doc.pdf', pageNumber: 1, snippet: 'Ueb' },
      note: '',
    },
  };

  for (const [key, status] of Object.entries(fieldStatusMap)) {
    const fieldKey = key as keyof ImmobilienFields;
    if (defaultFields[fieldKey] && status) {
      defaultFields[fieldKey].status = status;
    }
  }

  return {
    caseType: 'IMMOBILIENKAUF',
    caseTitle: 'Test Vorgang',
    analysisTimestamp: new Date().toISOString(),
    detectedDocuments: [],
    inquiries: [],
    overallStatus: 'READY',
    executiveSummary: 'Vollständig.',
    fields: defaultFields,
  };
}

describe('Readiness Domain Service', () => {
  it('returns true for isDossierEntwurfsreif when all fields are verified', () => {
    const dossier = createMockDossier();
    expect(isDossierEntwurfsreif(dossier)).toBe(true);
    expect(getDossierReadinessStage(dossier).stage).toBe('READY');
  });

  it('returns false for isDossierEntwurfsreif when a field is missing, but DRAFTING_POSSIBLE if core party/object fields are present', () => {
    const dossier = createMockDossier({ energieausweis: 'MISSING' });
    expect(isDossierEntwurfsreif(dossier)).toBe(false);
    expect(getDossierReadinessStage(dossier).stage).toBe('DRAFTING_POSSIBLE');
  });

  it('returns BLOCKED when essential party or object fields are missing', () => {
    const dossier = createMockDossier({
      verkaeufer: 'MISSING',
      kaeufer: 'MISSING',
    });
    expect(isDossierEntwurfsreif(dossier)).toBe(false);
    expect(getDossierReadinessStage(dossier).stage).toBe('BLOCKED');
  });
});
