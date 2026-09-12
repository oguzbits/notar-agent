import { describe, it, expect } from 'vitest';
import { Dossier, ImmobilienFields } from '@/types/dossier';
import {
  cleanSourceFileName,
  parseSourceLocations,
  extractFieldObservations,
  extractAllFieldRows,
  generatePruefberichtText,
} from './ui-mapper';

function createStubDossier(): Dossier {
  const fields: ImmobilienFields = {
    verkaeufer: {
      status: 'VERIFIED',
      data: {
        name: 'V Name',
        legalForm: 'natürliche Person',
        registeredOwnersGrundbuch: ['V Name'],
        authorizedRepresentatives: [],
        representationProofProvided: true,
        missingProofs: [],
      },
      source: { fileName: 'urkunde.pdf', pageNumber: 2, snippet: 'Verkäufer V Name' },
      note: '',
    },
    kaeufer: {
      status: 'NEEDS_REVIEW',
      data: {
        companyName: 'K GmbH',
        legalForm: 'GmbH',
        registerCourt: '',
        registerNumber: '',
        address: '',
        authorizedRepresentatives: [],
        hasOfficialRegisterProof: false,
      },
      source: { fileName: 'angebot.pdf + Notiz #1', pageNumber: 1, snippet: 'Käuferangebot' },
      note: 'HRB Auszug fehlt',
      actionRequired: 'Handelsregister anfordern',
    },
    grundbuch: {
      status: 'VERIFIED',
      data: {
        blatt: '123',
        amtsgericht: 'AG',
        grundbuchBezirk: 'Bezirk',
        standDatum: '2026-01-01',
        isCurrent: true,
      },
      source: { fileName: 'gb.pdf', pageNumber: 1, snippet: 'Blatt 123' },
      note: '',
    },
    grundstuecke: {
      status: 'VERIFIED',
      data: { parcels: [], totalAreaM2: 500, areaDiscrepancyNotes: '' },
      source: { fileName: 'gb.pdf', pageNumber: 2, snippet: '' },
      note: '',
    },
    kaufpreis: {
      status: 'VERIFIED',
      data: {
        amountInFigures: 250000,
        amountInWords: 'Zweihundertfünfzigtausend Euro',
        currency: 'EUR',
        previousOffers: [],
        priceEvolutionSummary: '',
        isFinalAgreedPrice: true,
      },
      source: { fileName: 'angebot.pdf', pageNumber: 1, snippet: '250.000 EUR' },
      note: '',
    },
    finanzierung: {
      status: 'VERIFIED',
      data: {
        mortgageAmount: 200000,
        lenderName: 'Bank',
        requiresFinancingPowerOfAttorney: false,
        interestRateAndPawnDetails: '',
      },
      source: { fileName: 'bank.pdf', pageNumber: 1, snippet: '' },
      note: '',
    },
    belastungen: {
      status: 'VERIFIED',
      data: { entries: [], clearingRequirements: [] },
      source: { fileName: 'gb.pdf', pageNumber: 3, snippet: '' },
      note: '',
    },
    mietverhaeltnisse: {
      status: 'VERIFIED',
      data: {
        yearlyNetRent: 0,
        statedInEmailOrOverview: '',
        rentableAreaM2: 0,
        unitCount: 0,
        fullRentedStatus: false,
        tenancyListAvailable: false,
        privacyOrRedactionNotes: '',
      },
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    energieausweis: {
      status: 'OUTDATED',
      data: {
        certificateType: 'VERBRAUCHSAUSWEIS',
        energyValueKWh: 150,
        efficiencyClass: 'E',
        validUntil: '2023-01-01',
        isExpired: true,
        primaryEnergyCarrier: 'Gas',
        buildingYear: '1990',
      },
      source: { fileName: 'energieausweis_alt.pdf', pageNumber: 1, snippet: 'Gültig bis 2023' },
      note: 'Energieausweis abgelaufen',
    },
    uebergabe: {
      status: 'VERIFIED',
      data: { targetDate: '2026-06-01', conditionDescription: 'Zahlung', riskTransferNotes: '' },
      source: { fileName: 'urkunde.pdf', pageNumber: 5, snippet: '' },
      note: '',
    },
  };

  return {
    caseType: 'IMMOBILIENKAUF',
    caseTitle: 'Test Vorgang',
    analysisTimestamp: '2026-09-12T00:00:00.000Z',
    detectedDocuments: [],
    inquiries: [],
    overallStatus: 'ACTION_REQUIRED',
    executiveSummary: '2 Felder erfordern Prüfung.',
    fields,
  };
}

describe('UI Mapper & Formatting Services', () => {
  it('cleanSourceFileName should trim and normalize input', () => {
    expect(cleanSourceFileName('  urkunde.pdf  ')).toBe('urkunde.pdf');
    expect(cleanSourceFileName('')).toBe('');
  });

  it('parseSourceLocations should handle combined and separated sources with deduplication', () => {
    const single = parseSourceLocations({
      fileName: 'urkunde.pdf',
      pageNumber: 3,
      snippet: 'Text',
    });
    expect(single).toEqual([{ fileName: 'urkunde.pdf', pageNumber: 3, snippet: 'Text' }]);

    const combined = parseSourceLocations({
      fileName: 'Doc1.pdf + Doc2.pdf; Doc1.pdf',
      pageNumber: 0,
      snippet: 'Ausschnitt',
    });
    expect(combined).toHaveLength(2);
    expect(combined[0].fileName).toBe('Doc1.pdf');
    expect(combined[1].fileName).toBe('Doc2.pdf');
  });

  it('extractFieldObservations should return only problematic fields (non-verified)', () => {
    const dossier = createStubDossier();
    const obs = extractFieldObservations(dossier);
    expect(obs).toHaveLength(2);
    expect(obs[0].fieldKey).toBe('kaeufer');
    expect(obs[0].status).toBe('NEEDS_REVIEW');
    expect(obs[0].actionRequired).toBe('Handelsregister anfordern');
    expect(obs[1].fieldKey).toBe('energieausweis');
    expect(obs[1].status).toBe('OUTDATED');
  });

  it('extractAllFieldRows should return all 10 fields in proper order', () => {
    const dossier = createStubDossier();
    const rows = extractAllFieldRows(dossier);
    expect(rows).toHaveLength(10);
    expect(rows[0].fieldKey).toBe('verkaeufer');
    expect(rows[0].fieldIndex).toBe(1);
    expect(rows[9].fieldKey).toBe('uebergabe');
    expect(rows[9].fieldIndex).toBe(10);
  });

  it('generatePruefberichtText should produce a complete textual audit report', () => {
    const dossier = createStubDossier();
    const report = generatePruefberichtText(dossier);
    expect(report).toContain('=== PRÜFBERICHT & FESTSTELLUNGEN ===');
    expect(report).toContain('Vorgang: Test Vorgang');
    expect(report).toContain('[2] Käufer [Prüfung nötig]: HRB Auszug fehlt');
    expect(report).toContain('[9] Energieausweis [Veraltet]: Energieausweis abgelaufen');
  });
});
