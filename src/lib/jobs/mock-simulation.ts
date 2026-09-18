import {
  ImmobilienDossier,
  CASE_TYPES,
  OVERALL_STATUS,
  FIELD_STATUS,
  DOCUMENT_RELIABILITY,
  INQUIRY_RECIPIENT,
  INQUIRY_PRIORITY,
  ENERGIEAUSWEIS_TYPES,
} from '@/types/dossier';

export interface SimulationParams {
  files: Array<{ name: string; size: number }>;
  notes: string;
  onStep: (step: number, stepDetail: string) => void;
  stepDelayMs?: number;
  abortSignal?: AbortSignal;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Vorgang abgebrochen'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Vorgang abgebrochen'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Führt eine realitätsnahe, kostenlose KI-Simulation mit definiertem Pacing durch.
 * Erlaubt das Testen des gesamten Workflows ohne API-Kosten.
 */
export async function runMockSimulation(params: SimulationParams): Promise<ImmobilienDossier> {
  const { files, notes, onStep, stepDelayMs = 2500, abortSignal } = params;
  const todayStr = new Date().toISOString().split('T')[0] ?? '2026-09-13';

  // Stufe 1: Urkunden- & Sachverhaltserfassung (Texterfassung & Strukturierung)
  onStep(1, 'Dokumentenstruktur analysieren und Textlayer extrahieren...');
  await delay(Math.round(stepDelayMs * 0.9), abortSignal);

  onStep(1, 'Beteiligte, Flurstücke und Kaufpreisangaben identifizieren...');
  await delay(Math.round(stepDelayMs * 1.1), abortSignal);

  // Stufe 2: Notarielle Vorprüfung & Plausibilisierung (Rechtsnormen & Konsistenzabgleich)
  onStep(2, 'Notary Auditor: Gesetzliche Prüfnormen (§ 80 GEG, § 17 BeurkG) prüfen...');
  await delay(Math.round(stepDelayMs * 1.1), abortSignal);

  onStep(2, 'Konsistenzprüfung: Grundbuchstand mit Entwurfsbestimmungen abgleichen...');
  await delay(Math.round(stepDelayMs * 1.1), abortSignal);

  onStep(2, 'Fälligkeitsvoraussetzungen und Belastungsvollmacht analysieren...');
  await delay(Math.round(stepDelayMs * 0.9), abortSignal);

  // Stufe 3: Prüfbericht & Cockpit-Aufbereitung
  onStep(3, 'Dossier-Cockpit aufbereiten und Quellenbelege indizieren...');
  await delay(Math.round(stepDelayMs * 1.0), abortSignal);

  const titleFromNotes = notes.trim()
    ? notes.trim().slice(0, 50)
    : 'Kaufvertrag Friedrichshain (Blatt 4512)';
  const primaryFileName = files[0]?.name ?? 'kaufvertrag_entwurf.pdf';

  const fileList =
    files.length > 0
      ? files.map((f, idx) => ({
          fileName: f.name,
          documentType: idx === 0 ? 'Kaufvertragsentwurf' : 'Anlage / Urkunde',
          date: todayStr,
          pageCount: Math.max(1, Math.round(f.size / 50000)),
          reliability: DOCUMENT_RELIABILITY.HIGH,
        }))
      : [
          {
            fileName: primaryFileName,
            documentType: 'Kaufvertragsentwurf',
            date: todayStr,
            pageCount: 12,
            reliability: DOCUMENT_RELIABILITY.HIGH,
          },
        ];

  const simulatedDossier: ImmobilienDossier = {
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    caseTitle: titleFromNotes,
    analysisTimestamp: new Date().toISOString(),
    overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
    executiveSummary:
      'KI-Vorprüfung (Simulationsmodus) abgeschlossen. 9 von 10 Pflichtfeldern belegt. Nachforderung für Energieausweis gem. § 80 GEG empfohlen.',
    detectedDocuments: fileList,
    inquiries: [
      {
        id: 'inq-sim-1',
        fieldKey: 'energieausweis',
        recipient: INQUIRY_RECIPIENT.VERKAEUFER,
        priority: INQUIRY_PRIORITY.HIGH,
        subject: 'Energieausweis fehlt gem. § 80 GEG',
        message: 'Bitte Energieausweis oder Nachweis über Denkmalstatus zur Akte nachreichen.',
        justification: 'Gesetzliche Pflichtangabe gem. Gebäudeenergiegesetz.',
        resolved: false,
      },
    ],
    userNotes: notes.trim() ? [notes.trim()] : [],
    fields: {
      verkaeufer: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          name: 'Maximilian Mustermann',
          legalForm: 'Natürliche Person',
          registeredOwnersGrundbuch: ['Maximilian Mustermann'],
          authorizedRepresentatives: [],
          representationProofProvided: true,
          missingProofs: [],
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 1,
          snippet: 'Herr Maximilian Mustermann, handelnd im eigenen Namen',
        },
        note: 'Identität und Eigentümerstellung im Grundbuch stimmig.',
      },
      kaeufer: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          companyName: 'Bona Fide Immobilien GmbH',
          legalForm: 'GmbH',
          registerCourt: 'Amtsgericht Charlottenburg',
          registerNumber: 'HRB 245890 B',
          address: 'Torstraße 140, 10119 Berlin',
          authorizedRepresentatives: ['Dr. Johannes Kaufmann (Geschäftsführer)'],
          hasOfficialRegisterProof: true,
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 2,
          snippet: 'Bona Fide Immobilien GmbH, HRB 245890 B, vertreten durch Dr. Johannes Kaufmann',
        },
        note: 'Handelsregisterauszug liegt vor.',
      },
      grundbuch: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          amtsgericht: 'Kreuzberg',
          grundbuchBezirk: 'Friedrichshain',
          blatt: '4512',
          standDatum: todayStr,
          isCurrent: true,
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 3,
          snippet: 'Grundbuch von Friedrichshain Blatt 4512',
        },
        note: 'Bestandsverzeichnis entspricht Entwurf.',
      },
      grundstuecke: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          parcels: [
            {
              gemarkung: 'Friedrichshain',
              flur: '12',
              flurstueckNummer: '89/4',
              wirtschaftsart: 'Gebäude- und Freifläche, Grünberger Str. 44',
              sizeM2: 520,
            },
          ],
          totalAreaM2: 520,
          areaDiscrepancyNotes: '',
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 3,
          snippet: 'Flur 12, Flurstück 89/4, Gebäude- und Freifläche 520 m²',
        },
        note: 'Flurstücksangaben vollständig.',
      },
      kaufpreis: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          amountInFigures: 850000,
          amountInWords: 'Achthundertfünfzigtausend Euro',
          currency: 'EUR',
          previousOffers: [],
          priceEvolutionSummary: '',
          isFinalAgreedPrice: true,
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 4,
          snippet:
            'Der Kaufpreis beträgt 850.000,00 EUR (in Worten: Euro achthundertfünfzigtausend).',
        },
        note: 'Kaufpreisfälligkeit an Fälligkeitsmitteilung gekoppelt.',
      },
      finanzierung: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          lenderName: 'Berliner Sparkasse',
          mortgageAmount: 680000,
          requiresFinancingPowerOfAttorney: true,
          interestRateAndPawnDetails: 'Finanzierungsvollmacht bis 680.000 EUR nebst Zinsen',
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 6,
          snippet: 'Belastungsvollmacht für Finanzierungs-Grundschuld bis zu 680.000,00 EUR',
        },
        note: 'Standardklausel gem. Kanzleivorlage.',
      },
      belastungen: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          entries: [
            {
              section: 'II',
              runningNumber: '1',
              description:
                'Geh- und Fahrrecht zugunsten des jeweiligen Eigentümers von Flurstück 89/3',
              amount: '',
              creditor: 'Nachbareigentümer',
              intendedHandling: 'UEBERNAHME',
              notes: 'Keine wertmindernden Altlasten.',
            },
          ],
          clearingRequirements: [],
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 5,
          snippet:
            'Abt. II Nr. 1: Geh- und Fahrrecht wird ohne Anrechnung auf den Kaufpreis übernommen.',
        },
        note: 'Keine wertmindernden Altlasten oder Zwangsvermerke.',
      },
      mietverhaeltnisse: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          yearlyNetRent: 48000,
          statedInEmailOrOverview: 'Vollvermietet, 4 Wohneinheiten',
          rentableAreaM2: 380,
          unitCount: 4,
          fullRentedStatus: true,
          tenancyListAvailable: true,
          privacyOrRedactionNotes: 'Mieterliste gem. DSGVO pseudonymisiert',
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 7,
          snippet:
            'Das Objekt ist vermietet. Der Übergang der Mietverhältnisse erfolgt zum Stichtag.',
        },
        note: 'Mietkautionen sind auf Anderkonto/Käufer zu übertragen.',
      },
      energieausweis: {
        status: FIELD_STATUS.NEEDS_REVIEW,
        data: {
          certificateType: ENERGIEAUSWEIS_TYPES.BEDARFSAUSWEIS,
          energyValueKWh: 0,
          efficiencyClass: '',
          validUntil: '',
          isExpired: false,
          primaryEnergyCarrier: 'Gas',
          buildingYear: '1910',
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 8,
          snippet: 'Ein Energieausweis lag bei Beurkundung noch nicht vor.',
        },
        note: 'Pflichtangabe nach § 80 GEG fehlt. Vorlage vor Beurkundung anfordern.',
      },
      uebergabe: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          targetDate: '2026-11-01',
          conditionDescription:
            'Besitz-, Nutzen- und Lastenwechsel am 1. des Folgemonats nach Kaufpreiszahlung',
          riskTransferNotes: 'Gefahrübergang mit Übergabe',
        },
        source: {
          fileName: primaryFileName,
          pageNumber: 9,
          snippet:
            'Besitz und Nutzungen gehen mit vollständiger Kaufpreiszahlung auf den Käufer über.',
        },
        note: 'Übergabedatum stimmig geregelt.',
      },
    },
  };

  return simulatedDossier;
}
