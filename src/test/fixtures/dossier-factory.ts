import {
  ImmobilienDossier,
  ImmobilienFields,
  FieldStatus,
  FIELD_STATUS,
  CASE_TYPES,
  OVERALL_STATUS,
  ENERGIEAUSWEIS_TYPES,
  GenericFieldDossier,
} from '@/types/dossier';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

export function createTestImmobilienFields(
  fieldStatusMap: Partial<Record<keyof ImmobilienFields, FieldStatus>> = {}
): ImmobilienFields {
  const fields: ImmobilienFields = {
    verkaeufer: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        name: 'Musterverkäufer GmbH',
        legalForm: 'GmbH',
        registeredOwnersGrundbuch: ['Musterverkäufer GmbH'],
        authorizedRepresentatives: ['Max Mustermann'],
        representationProofProvided: true,
        missingProofs: [],
      },
      source: { fileName: 'expose.pdf', pageNumber: 1, snippet: 'Verkäufer' },
      note: '',
    },
    kaeufer: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        companyName: 'Musterkäufer GmbH',
        legalForm: 'GmbH',
        registerCourt: 'Amtsgericht Musterstadt',
        registerNumber: 'HRB 1234',
        address: 'Musterstraße 1',
        authorizedRepresentatives: ['Max Mustermann'],
        hasOfficialRegisterProof: true,
      },
      source: { fileName: 'hr_auszug.pdf', pageNumber: 1, snippet: 'Käufer' },
      note: '',
    },
    grundbuch: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        blatt: '1234',
        amtsgericht: 'Amtsgericht Musterstadt',
        grundbuchBezirk: 'Musterbezirk',
        standDatum: '2026-01-01',
        isCurrent: true,
      },
      source: { fileName: 'grundbuch.pdf', pageNumber: 1, snippet: 'Grundbuch' },
      note: '',
    },
    grundstuecke: {
      status: FIELD_STATUS.VERIFIED,
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
      source: { fileName: 'kataster.pdf', pageNumber: 1, snippet: 'Flurstück' },
      note: '',
    },
    kaufpreis: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        amountInFigures: 1000000,
        amountInWords: 'Eine Million Euro',
        currency: 'EUR',
        previousOffers: [],
        priceEvolutionSummary: '',
        isFinalAgreedPrice: true,
      },
      source: { fileName: 'vertrag.pdf', pageNumber: 1, snippet: 'Kaufpreis' },
      note: '',
    },
    finanzierung: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        lenderName: 'Musterbank AG',
        mortgageAmount: 800000,
        requiresFinancingPowerOfAttorney: true,
        interestRateAndPawnDetails: '',
      },
      source: { fileName: 'bank.pdf', pageNumber: 1, snippet: 'Finanzierung' },
      note: '',
    },
    belastungen: {
      status: FIELD_STATUS.VERIFIED,
      data: { entries: [], clearingRequirements: [] },
      source: { fileName: 'grundbuch.pdf', pageNumber: 2, snippet: 'Lastenfrei' },
      note: '',
    },
    mietverhaeltnisse: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        yearlyNetRent: 12000,
        statedInEmailOrOverview: 'Mietaufstellung',
        rentableAreaM2: 100,
        unitCount: 1,
        fullRentedStatus: true,
        tenancyListAvailable: true,
        privacyOrRedactionNotes: '',
      },
      source: { fileName: 'miete.pdf', pageNumber: 1, snippet: 'Mieten' },
      note: '',
    },
    energieausweis: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        efficiencyClass: 'B',
        certificateType: ENERGIEAUSWEIS_TYPES.VERBRAUCHSAUSWEIS,
        energyValueKWh: 60,
        validUntil: '2030-01-01',
        isExpired: false,
        primaryEnergyCarrier: 'Gas',
        buildingYear: '2000',
      },
      source: { fileName: 'energieausweis.pdf', pageNumber: 1, snippet: 'Ausweis' },
      note: '',
    },
    uebergabe: {
      status: FIELD_STATUS.VERIFIED,
      data: {
        targetDate: '2026-12-01',
        conditionDescription: 'Nach Kaufpreiszahlung',
        riskTransferNotes: 'Nutzen und Lasten ab Übergabe',
      },
      source: { fileName: 'vertrag.pdf', pageNumber: 1, snippet: 'Übergabe' },
      note: '',
    },
  };

  for (const [key, status] of Object.entries(fieldStatusMap)) {
    const fieldKey = key as keyof ImmobilienFields;
    if (fields[fieldKey] && status) {
      fields[fieldKey].status = status;
    }
  }

  return fields;
}

export function createTestImmobilienDossier(
  overrides?: Partial<Omit<ImmobilienDossier, 'caseType' | 'fields'>> & {
    fields?: DeepPartial<ImmobilienFields>;
    fieldStatusMap?: Partial<Record<keyof ImmobilienFields, FieldStatus>>;
  }
): ImmobilienDossier {
  const baseFields = createTestImmobilienFields(overrides?.fieldStatusMap);

  const baseRecord = baseFields as Record<string, GenericFieldDossier<Record<string, unknown>>>;
  const mergedFields: Record<string, unknown> = { ...baseFields };
  if (overrides?.fields) {
    for (const [key, val] of Object.entries(overrides.fields)) {
      if (val && typeof val === 'object') {
        const baseField = baseRecord[key];
        const valObj = val as {
          status?: FieldStatus;
          note?: string;
          actionRequired?: string;
          data?: Record<string, unknown>;
          source?: Record<string, unknown>;
        };

        mergedFields[key] = {
          ...baseField,
          ...valObj,
          data: valObj.data !== undefined ? { ...valObj.data } : { ...(baseField?.data || {}) },
          source: {
            ...(baseField?.source || {}),
            ...(valObj.source || {}),
          },
        };
      }
    }
  }

  return {
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    caseTitle: 'Test Vorgang',
    analysisTimestamp: '2026-03-01T12:00:00Z',
    detectedDocuments: [],
    inquiries: [],
    overallStatus: OVERALL_STATUS.READY,
    executiveSummary: 'Test Zusammenfassung',
    ...overrides,
    fields: mergedFields as ImmobilienFields,
  };
}
