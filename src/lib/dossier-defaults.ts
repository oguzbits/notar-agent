import { ImmobilienFields, FIELD_STATUS, ENERGIEAUSWEIS_TYPES } from '@/types/dossier';

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
      status: FIELD_STATUS.MISSING,
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
      status: FIELD_STATUS.MISSING,
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
      status: FIELD_STATUS.MISSING,
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    grundstuecke: {
      data: {
        parcels: [],
        totalAreaM2: 0,
        areaDiscrepancyNotes: '',
      },
      status: FIELD_STATUS.MISSING,
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
      status: FIELD_STATUS.MISSING,
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
      status: FIELD_STATUS.MISSING,
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    belastungen: {
      data: {
        entries: [],
        clearingRequirements: [],
      },
      status: FIELD_STATUS.MISSING,
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
      status: FIELD_STATUS.MISSING,
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    energieausweis: {
      data: {
        certificateType: ENERGIEAUSWEIS_TYPES.UNBEKANNT,
        energyValueKWh: 0,
        efficiencyClass: '',
        validUntil: '',
        isExpired: false,
        primaryEnergyCarrier: '',
        buildingYear: '',
      },
      status: FIELD_STATUS.MISSING,
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
    uebergabe: {
      data: {
        targetDate: '',
        conditionDescription: '',
        riskTransferNotes: '',
      },
      status: FIELD_STATUS.MISSING,
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
    },
  };
}
