import { ImmobilienFields } from '@/types/dossier';

export function createEmptyImmobilienFields(): ImmobilienFields {
  return {
    verkaeufer: {
      data: {
        name: '',
        legalForm: '',
        registeredOwnersGrundbuch: [],
        authorizedRepresentatives: [],
        representationProofProvided: false,
        missingProofs: [],
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    kaeufer: {
      data: {
        companyName: '',
        legalForm: '',
        registerCourt: '',
        registerNumber: '',
        address: '',
        authorizedRepresentatives: [],
        hasOfficialRegisterProof: false,
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    grundbuch: {
      data: {
        amtsgericht: '',
        grundbuchBezirk: '',
        blatt: '',
        standDatum: '',
        isCurrent: true,
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    grundstuecke: {
      data: {
        parcels: [],
        totalAreaM2: 0,
        areaDiscrepancyNotes: '',
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    kaufpreis: {
      data: {
        amountInFigures: 0,
        amountInWords: '',
        currency: 'EUR',
        previousOffers: [],
        priceEvolutionSummary: '',
        isFinalAgreedPrice: false,
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    finanzierung: {
      data: {
        lenderName: '',
        mortgageAmount: 0,
        requiresFinancingPowerOfAttorney: false,
        interestRateAndPawnDetails: '',
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    belastungen: {
      data: {
        entries: [],
        clearingRequirements: [],
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    mietverhaeltnisse: {
      data: {
        yearlyNetRent: 0,
        statedInEmailOrOverview: '',
        rentableAreaM2: 0,
        unitCount: 0,
        fullRentedStatus: false,
        tenancyListAvailable: false,
        privacyOrRedactionNotes: '',
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    energieausweis: {
      data: {
        certificateType: 'UNBEKANNT',
        energyValueKWh: 0,
        efficiencyClass: '',
        validUntil: '',
        isExpired: false,
        primaryEnergyCarrier: '',
        buildingYear: '',
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    uebergabe: {
      data: {
        targetDate: '',
        conditionDescription: '',
        riskTransferNotes: '',
      },
      status: 'MISSING',
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
  };
}
