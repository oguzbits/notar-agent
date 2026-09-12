import { describe, it, expect } from 'vitest';
import { Dossier, ImmobilienFields } from '@/types/dossier';
import { normalizeDossier } from './dossier';

function createBaseDossier(): Dossier {
  const fields: ImmobilienFields = {
    verkaeufer: {
      status: 'VERIFIED',
      data: {
        name: 'Muster Verkäufer GmbH',
        legalForm: 'GmbH',
        registeredOwnersGrundbuch: ['Muster Verkäufer GmbH'],
        authorizedRepresentatives: [],
        representationProofProvided: true,
        missingProofs: [],
      },
      source: { fileName: 'urkunde_alt.pdf', pageNumber: 1, snippet: 'Eigentümer' },
      note: '',
    },
    kaeufer: {
      status: 'NEEDS_REVIEW',
      data: {
        companyName: 'Muster Käufer GmbH',
        legalForm: 'GmbH',
        registerCourt: 'Amtsgericht Musterstadt',
        registerNumber: 'HRB 9999',
        address: 'Musterweg 2',
        authorizedRepresentatives: [],
        hasOfficialRegisterProof: false,
      },
      source: { fileName: 'Notiz #1', pageNumber: 1, snippet: 'Käuferin' },
      note: 'Handelsregisterauszug noch nicht vorgelegt.',
    },
    grundbuch: {
      status: 'VERIFIED',
      data: {
        blatt: '100',
        amtsgericht: 'Amtsgericht',
        grundbuchBezirk: 'Bezirk',
        standDatum: '2026-01-01',
        isCurrent: true,
      },
      source: { fileName: 'urkunde_alt.pdf', pageNumber: 1, snippet: 'Blatt 100' },
      note: '',
    },
    grundstuecke: {
      status: 'VERIFIED',
      data: { parcels: [], totalAreaM2: 500, areaDiscrepancyNotes: '' },
      source: { fileName: 'urkunde_alt.pdf', pageNumber: 1, snippet: 'Parzelle' },
      note: '',
    },
    kaufpreis: {
      status: 'VERIFIED',
      data: {
        amountInFigures: 400000,
        amountInWords: 'Vierhunderttausend Euro',
        currency: 'EUR',
        previousOffers: [380000],
        priceEvolutionSummary: 'Nachverhandlung',
        isFinalAgreedPrice: true,
      },
      source: { fileName: 'Notiz #1', pageNumber: 1, snippet: '400.000 EUR' },
      note: '',
    },
    finanzierung: {
      status: 'VERIFIED',
      data: {
        mortgageAmount: 300000,
        lenderName: 'Bank',
        requiresFinancingPowerOfAttorney: false,
        interestRateAndPawnDetails: '',
      },
      source: { fileName: 'Notiz #1', pageNumber: 1, snippet: '300.000 EUR' },
      note: '',
    },
    belastungen: {
      status: 'VERIFIED',
      data: { entries: [], clearingRequirements: [] },
      source: { fileName: 'urkunde_alt.pdf', pageNumber: 1, snippet: 'Keine' },
      note: '',
    },
    mietverhaeltnisse: {
      status: 'VERIFIED',
      data: {
        yearlyNetRent: 20000,
        statedInEmailOrOverview: 'Miete',
        rentableAreaM2: 120,
        unitCount: 1,
        fullRentedStatus: true,
        tenancyListAvailable: true,
        privacyOrRedactionNotes: '',
      },
      source: { fileName: 'urkunde_alt.pdf', pageNumber: 1, snippet: 'Miete' },
      note: '',
    },
    energieausweis: {
      status: 'VERIFIED',
      data: {
        efficiencyClass: 'A',
        certificateType: 'VERBRAUCHSAUSWEIS',
        energyValueKWh: 45,
        validUntil: '2030-01-01',
        isExpired: false,
        primaryEnergyCarrier: 'Gas',
        buildingYear: '2015',
      },
      source: { fileName: 'urkunde_alt.pdf', pageNumber: 1, snippet: 'A' },
      note: '',
    },
    uebergabe: {
      status: 'VERIFIED',
      data: {
        targetDate: '2026-12-01',
        conditionDescription: 'Nach Kaufpreiszahlung',
        riskTransferNotes: 'Nutzen/Lasten',
      },
      source: { fileName: 'Notiz #1', pageNumber: 1, snippet: '01.12.' },
      note: '',
    },
  };

  return {
    caseType: 'IMMOBILIENKAUF',
    caseTitle: 'Vorgang 2001',
    analysisTimestamp: '2026-09-01T10:00:00.000Z',
    detectedDocuments: [
      {
        fileName: 'Notiz #1',
        documentType: 'Bearbeitungsvermerk / Notiz',
        date: '2026-09-01',
        pageCount: 1,
        reliability: 'LOW',
        summary: 'Erstes Anschreiben mit Vorangebot 400.000 EUR.',
      },
      {
        fileName: 'urkunde_alt.pdf',
        documentType: 'Urkunde',
        date: '2015-05-10',
        pageCount: 4,
        reliability: 'HIGH',
      },
    ],
    inquiries: [
      {
        id: 'inq-1',
        fieldKey: 'kaeufer',
        recipient: 'MAKLER',
        priority: 'CRITICAL',
        subject: 'Handelsregisterauszug fehlt',
        message: 'Bitte einreichen.',
        justification: 'Nachweis erforderlich.',
        resolved: false,
      },
    ],
    overallStatus: 'ACTION_REQUIRED',
    executiveSummary: 'Erstanalyse mit offenen Nachforderungen.',
    userNotes: ['Erstes Anschreiben mit Vorangebot 400.000 EUR.'],
    fields,
  };
}

describe('User Journey: Inkrementelle Nachreichung & Delta-Updates', () => {
  it('sollte bei einer Nachreichung neue Notizen fortlaufend nummerieren (Notiz #2) und an den Anfang stellen', () => {
    const base = createBaseDossier();
    const newNoteText =
      'Käufer reicht Handelsregisterauszug HRB 99999 nach. Vertretung nachgewiesen.';

    const updated = normalizeDossier(base, [newNoteText]);

    // userNotes muss nun 2 Notizen enthalten
    expect(updated.userNotes).toHaveLength(2);
    expect(updated.userNotes![1]).toBe(newNoteText);

    // detectedDocuments muss Notiz #1 und Notiz #2 enthalten
    const noteDocs = updated.detectedDocuments.filter((d) => d.fileName.startsWith('Notiz #'));
    expect(noteDocs).toHaveLength(2);
    expect(noteDocs[0].fileName).toBe('Notiz #1');
    expect(noteDocs[1].fileName).toBe('Notiz #2');
    expect(noteDocs[1].summary).toBe(newNoteText);

    // Bestandsdokumente (urkunde_alt.pdf) müssen erhalten bleiben
    const otherDocs = updated.detectedDocuments.filter((d) => d.fileName === 'urkunde_alt.pdf');
    expect(otherDocs).toHaveLength(1);
  });

  it('sollte doppelte Notizen ignorieren und nicht mehrfach einfügen (Idempotenz)', () => {
    const base = createBaseDossier();
    const existingNote = 'Erstes Anschreiben mit Vorangebot 400.000 EUR.';

    const updated = normalizeDossier(base, [existingNote]);

    expect(updated.userNotes).toHaveLength(1);
    const noteDocs = updated.detectedDocuments.filter((d) => d.fileName.startsWith('Notiz #'));
    expect(noteDocs).toHaveLength(1);
  });
});
