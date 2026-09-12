import { describe, it, expect } from 'vitest';
import { Dossier, FieldStatus, Inquiry, ImmobilienFields } from '@/types/dossier';
import {
  isDossierEntwurfsreif,
  extractFieldObservations,
  parseSourceLocations,
  generatePruefberichtText,
} from './dossier';

function createMockDossier(
  fieldStatusMap: Partial<Record<keyof ImmobilienFields, FieldStatus>> = {},
  inquiries: Inquiry[] = []
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
      if (status !== 'VERIFIED') {
        defaultFields[fieldKey].note = `Prüfung für ${key} erforderlich`;
      }
    }
  }

  return {
    caseType: 'IMMOBILIENKAUF',
    caseTitle: 'Test Vorgang 1001',
    analysisTimestamp: new Date().toISOString(),
    detectedDocuments: [],
    inquiries,
    overallStatus: 'READY',
    executiveSummary: 'Alle Pflichtfelder vollständig geprüft.',
    fields: defaultFields,
  };
}

describe('Notarielle Entwurfsreife & Prüfbericht-Logik', () => {
  it('sollte TRUE zurückgeben, wenn alle 10 Pflichtfelder VERIFIED sind und keine ungelöste kritische Nachforderung vorliegt', () => {
    const dossier = createMockDossier();
    expect(isDossierEntwurfsreif(dossier)).toBe(true);
  });

  it('sollte FALSE zurückgeben, wenn auch nur ein einziges Pflichtfeld NEEDS_REVIEW, OUTDATED oder MISSING ist', () => {
    const withReview = createMockDossier({ kaufpreis: 'NEEDS_REVIEW' });
    expect(isDossierEntwurfsreif(withReview)).toBe(false);

    const withOutdated = createMockDossier({ energieausweis: 'OUTDATED' });
    expect(isDossierEntwurfsreif(withOutdated)).toBe(false);

    const withMissing = createMockDossier({ kaeufer: 'MISSING' });
    expect(isDossierEntwurfsreif(withMissing)).toBe(false);
  });

  it('sollte TRUE zurückgeben, wenn alle Felder VERIFIED sind (Option B: Nachforderungen blockieren nicht)', () => {
    const dossier = createMockDossier({}, [
      {
        id: 'inq-1',
        fieldKey: 'kaeufer',
        recipient: 'MAKLER',
        priority: 'CRITICAL',
        subject: 'Handelsregisterauszug fehlt',
        message: 'Bitte reichen Sie den aktuellen Auszug ein.',
        justification: 'Nachweis der Vertretung zwingend erforderlich.',
        resolved: false,
      },
    ]);

    expect(isDossierEntwurfsreif(dossier)).toBe(true);
  });

  it('sollte TRUE zurückgeben, wenn alle Felder VERIFIED sind und eine ungelöste Nachforderung Priorität MEDIUM oder HIGH hat', () => {
    const dossier = createMockDossier({}, [
      {
        id: 'inq-2',
        fieldKey: 'energieausweis',
        recipient: 'MAKLER',
        priority: 'MEDIUM',
        subject: 'Hinweis zu Ausweis',
        message: 'Bitte Baujahr prüfen.',
        justification: 'Optional.',
        resolved: false,
      },
    ]);

    expect(isDossierEntwurfsreif(dossier)).toBe(true);
  });
});

describe('Feststellungs-Extraktion & Audit-Trail Parsing', () => {
  it('sollte alle problematischen Felder extrahieren und sortiert nach Feldindex ausgeben', () => {
    const dossier = createMockDossier({
      kaufpreis: 'NEEDS_REVIEW',
      energieausweis: 'OUTDATED',
    });

    const observations = extractFieldObservations(dossier);
    expect(observations.length).toBe(2);

    expect(observations[0].fieldKey).toBe('kaufpreis');
    expect(observations[0].fieldIndex).toBe(5);
    expect(observations[0].status).toBe('NEEDS_REVIEW');

    expect(observations[1].fieldKey).toBe('energieausweis');
    expect(observations[1].fieldIndex).toBe(9);
    expect(observations[1].status).toBe('OUTDATED');
  });

  it('sollte kombinierte Quellenangaben mit Trennzeichen (+, ;, und) korrekt parsen', () => {
    const source1 = { fileName: 'Notiz #1 + grundbuch.pdf', pageNumber: 3, snippet: 'Zitat A' };
    const parsed1 = parseSourceLocations(source1);
    expect(parsed1.length).toBe(2);
    expect(parsed1[0].fileName).toBe('Notiz #1');
    expect(parsed1[1].fileName).toBe('grundbuch.pdf');

    const source2 = { fileName: 'DocA; DocB; DocA', pageNumber: 1, snippet: 'Zitat B' };
    const parsed2 = parseSourceLocations(source2);
    // Duplikate müssen eliminiert werden
    expect(parsed2.length).toBe(2);
    expect(parsed2.map((p) => p.fileName)).toEqual(['DocA', 'DocB']);
  });

  it('sollte einen formatierten Prüfbericht-Text mit allen Feststellungen generieren', () => {
    const dossier = createMockDossier({ kaufpreis: 'NEEDS_REVIEW' });
    const text = generatePruefberichtText(dossier);

    expect(text).toContain('PRÜFBERICHT & FESTSTELLUNGEN');
    expect(text).toContain('Status: PRÜFUNGSBEDARF');
    expect(text).toContain('Kaufpreis');
    expect(text).toContain('Prüfung für kaufpreis erforderlich');
  });
});
