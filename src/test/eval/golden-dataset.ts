import fs from 'node:fs';
import path from 'node:path';
import {
  CASE_TYPES,
  ENERGIEAUSWEIS_TYPES,
  FIELD_STATUS,
  FieldStatus,
  OVERALL_STATUS,
  OverallStatus,
  UploadedFilePayload,
} from '@/types/dossier';

export interface GroundTruthField {
  expectedStatus: FieldStatus | FieldStatus[];
  expectedValues?: Record<string, unknown>;
  mustContainInSnippet?: string[];
}

export interface GoldenTestCase {
  id: string;
  name: string;
  description: string;
  caseType: typeof CASE_TYPES.IMMOBILIENKAUF;
  files: UploadedFilePayload[];
  notes: string;
  groundTruth: {
    expectedOverallStatus: OverallStatus;
    fields: Record<string, GroundTruthField>;
    expectedInquiriesCount?: number;
  };
}

/**
 * Liest eine reale Datei aus dem Verzeichnis test-akten/ deterministisch
 * als UploadedFilePayload (Base64 kodiert für Multimodalität & unpdf) ein.
 */
function loadTestAktenFile(subfolder: string, filename: string): UploadedFilePayload {
  const absolutePath = path.resolve(process.cwd(), 'test-akten', subfolder, filename);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Testakte nicht gefunden: ${absolutePath}`);
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const ext = path.extname(filename).toLowerCase();

  let mimeType = 'application/octet-stream';
  if (ext === '.pdf') {
    mimeType = 'application/pdf';
  } else if (ext === '.png') {
    mimeType = 'image/png';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    mimeType = 'image/jpeg';
  } else if (ext === '.txt') {
    mimeType = 'text/plain';
  }

  const isBinary = ext === '.pdf' || ext === '.png' || ext === '.jpg' || ext === '.jpeg';
  const base64Content = fileBuffer.toString('base64');

  return {
    name: filename,
    type: mimeType,
    size: fileBuffer.length,
    isBase64: isBinary,
    content: isBinary ? `data:${mimeType};base64,${base64Content}` : fileBuffer.toString('utf-8'),
  };
}

/**
 * GOLDEN DATASET DER NOTARPARTNER-REFERENZAKTEN (FÄLLE 01 BIS 08)
 *
 * Bildet die juristische und technische Wahrheit (Ground Truth) für den echten
 * Dokumentenbestand aus test-akten/ ab.
 */
export const GOLDEN_DATASET: GoldenTestCase[] = [
  // =========================================================================
  // FALL 01: PERSONALAUSWEIS-PRÜFUNG (MULTIMODALITÄTS-STRESSTEST)
  // =========================================================================
  {
    id: 'fall-01-ausweis-pruefung',
    name: 'Fall 01: Multimodalitäts-Stresstest (Verwackelter Ausweis vs. Referenz)',
    description:
      'Prüft die multimodale Lesbarkeit: Erkennt das Modell Unleserlichkeit bei 4.5px Weichzeichnung als NEEDS_REVIEW, statt Personalausweisdaten zu halluzinieren?',
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [
      loadTestAktenFile('fall-01-ausweis-pruefung', 'Personalausweis_Scan.png'),
      loadTestAktenFile('fall-01-ausweis-pruefung', 'Personalausweis_Referenz.png'),
    ],
    notes: 'Käuferin hat vorab einen Smartphone-Scan übersandt. Notariat verlangt Ausweisabgleich.',
    groundTruth: {
      expectedOverallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        kaeufer: {
          expectedStatus: [FIELD_STATUS.VERIFIED, FIELD_STATUS.NEEDS_REVIEW],
          expectedValues: {
            companyName: 'Erika Mustermann',
            legalForm: 'natürliche Person',
            hasOfficialRegisterProof: true,
          },
          mustContainInSnippet: ['MUSTERMANN', 'ERIKA'],
        },
      },
    },
  },

  // =========================================================================
  // FALL 02: GRUNDBUCH-VOLLSTÄNDIGKEIT (§ 21 BeurkG)
  // =========================================================================
  {
    id: 'fall-02-grundbuch-vollstaendigkeit',
    name: 'Fall 02: Unvollständiger Grundbuchauszug (Abteilung I fehlt)',
    description:
      'Amtlicher Grundbuchauszug Köln-Lindenthal Blatt 5412. Seite 2 (Abteilung I & II) fehlt physisch. Keine Beurkundungsreife ohne Eigentumsprüfung gem. § 21 BeurkG.',
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [
      loadTestAktenFile('fall-02-grundbuch-vollstaendigkeit', 'Grundbuchauszug_Lindenthal.pdf'),
    ],
    notes: 'Auszug vom Amtsgericht liegt bisher nur unvollständig vor.',
    groundTruth: {
      expectedOverallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        verkaeufer: {
          expectedStatus: [FIELD_STATUS.NEEDS_REVIEW, FIELD_STATUS.MISSING],
          mustContainInSnippet: ['fehlt'],
        },
        grundbuch: {
          expectedStatus: FIELD_STATUS.NEEDS_REVIEW,
          expectedValues: {
            blatt: '14205',
          },
          mustContainInSnippet: ['14205'],
        },
      },
    },
  },

  // =========================================================================
  // FALL 03: VERTRAGSÄNDERUNG MIT HANDSCHRIFTLICHER RANDKORREKTUR
  // =========================================================================
  {
    id: 'fall-03-vertragsaenderung-handschrift',
    name: 'Fall 03: Handschriftliche Randkorrektur des Kaufpreises',
    description:
      'Gedruckter Betrag 450.000 € mit blauer Kugelschreiber-Tinte gestrichen. Handschriftliche Randkorrektur "425.000,00 EUR" mit Notarparaphe.',
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [loadTestAktenFile('fall-03-vertragsaenderung-handschrift', 'Kaufvertrag_Auszug.pdf')],
    notes: 'Parteien haben im Vorbesprechungstermin eine Minderung vereinbart.',
    groundTruth: {
      expectedOverallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        kaufpreis: {
          expectedStatus: FIELD_STATUS.NEEDS_REVIEW,
          expectedValues: {
            amountInFigures: 425000,
          },
          mustContainInSnippet: ['425.000'],
        },
        verkaeufer: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            name: 'Dr. Elena Rostova',
            legalForm: 'natürliche Person',
          },
          mustContainInSnippet: ['Rostova'],
        },
        kaeufer: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            companyName: 'Marc Albrecht',
            legalForm: 'natürliche Person',
          },
          mustContainInSnippet: ['Albrecht'],
        },
      },
    },
  },

  // =========================================================================
  // FALL 04: STANDARD-URKUNDE (HAPPY PATH)
  // =========================================================================
  {
    id: 'fall-04-standard-urkunde',
    name: 'Fall 04: Standard-Kaufvertrag Köln (Vollständig & Fehlefrei)',
    description:
      'Standard-Urkunde UR 2026/89: Maria Fischer an Jan Schmidt, Kaufpreis 550.000 EUR, Grundbuch Köln Blatt 1042.',
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [loadTestAktenFile('fall-04-standard-urkunde', 'Kaufvertrag_Koeln_UR89.pdf')],
    notes: '',
    groundTruth: {
      expectedOverallStatus: OVERALL_STATUS.READY,
      fields: {
        verkaeufer: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            name: 'Maria Fischer',
            legalForm: 'natürliche Person',
          },
          mustContainInSnippet: ['Maria Fischer'],
        },
        kaeufer: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            companyName: 'Jan Schmidt',
            legalForm: 'natürliche Person',
          },
          mustContainInSnippet: ['Jan Schmidt'],
        },
        kaufpreis: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            amountInFigures: 550000,
          },
          mustContainInSnippet: ['550.000'],
        },
        grundbuch: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            blatt: '1042',
          },
          mustContainInSnippet: ['1042'],
        },
      },
    },
  },

  // =========================================================================
  // FALL 05: ENERGIEAUSWEIS WOHNGEBÄUDE (AMTLICHES BUNDESMUSTER GÜLTIG)
  // =========================================================================
  {
    id: 'fall-05-energieausweis-wohngebaeude',
    name: 'Fall 05: Amtlicher GEG-Bedarfsausweis Wohngebäude (Gültig bis 2034)',
    description:
      'Offizieller 5-seitiger GEG24-Bedarfsausweis Beethovenstr. 12, Köln. Endenergie 78,5 kWh/(m²a), Klasse C, gültig bis 13.05.2034.',
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [
      loadTestAktenFile('fall-05-energieausweis-wohngebaeude', 'Energieausweis_Beethovenstr.pdf'),
    ],
    notes: 'Energieausweis liegt im Original vor.',
    groundTruth: {
      expectedOverallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        energieausweis: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            certificateType: ENERGIEAUSWEIS_TYPES.BEDARFSAUSWEIS,
            energyValueKWh: 78.5,
            efficiencyClass: 'C',
            validUntil: '2034-05-13',
            isExpired: false,
          },
          mustContainInSnippet: ['78,5', '13.05.2034'],
        },
      },
    },
  },

  // =========================================================================
  // FALL 06: ENERGIEAUSWEIS PRÜFFRIST (FRISTFALLE GEM. § 80 GEG)
  // =========================================================================
  {
    id: 'fall-06-energieausweis-prueffrist',
    name: 'Fall 06: Abgelaufener Energieausweis Aachener Str. (§ 80 GEG)',
    description:
      'Gültig bis 10.02.2023. Das Dokument ist vollkommen neutral ohne Farbhervorhebungen gedruckt. Das System muss das Datum mit dem Stichtag abgleichen und auf OUTDATED setzen.',
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [
      loadTestAktenFile('fall-06-energieausweis-prueffrist', 'Energieausweis_AachenerStr.pdf'),
    ],
    notes: '',
    groundTruth: {
      expectedOverallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        energieausweis: {
          expectedStatus: FIELD_STATUS.OUTDATED,
          expectedValues: {
            certificateType: ENERGIEAUSWEIS_TYPES.BEDARFSAUSWEIS,
            energyValueKWh: 182,
            efficiencyClass: 'F',
            validUntil: '2023-02-10',
            isExpired: true,
          },
          mustContainInSnippet: ['10.02.2023'],
        },
      },
    },
  },

  // =========================================================================
  // FALL 07: GEWERBE-ENERGIEAUSWEIS (NICHTWOHNGEBÄUDE)
  // =========================================================================
  {
    id: 'fall-07-gewerbe-energieausweis',
    name: 'Fall 07: Gewerbe-Energieausweis Nichtwohngebäude (Hohenzollernring)',
    description:
      'Amtlicher Nichtwohngebäude-Bedarfsausweis. Getrennte Ausweisung von Wärme (94,0 kWh) und Strom (42,5 kWh), Nettogrundfläche 1.420 m².',
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [
      loadTestAktenFile('fall-07-gewerbe-energieausweis', 'Energieausweis_Hohenzollernring.pdf'),
    ],
    notes: 'Gewerbeobjekt mit Büro- und Geschäftsnutzung.',
    groundTruth: {
      expectedOverallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        energieausweis: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            certificateType: ENERGIEAUSWEIS_TYPES.BEDARFSAUSWEIS,
            energyValueKWh: [94, 118.2],
            validUntil: '2034-08-28',
            isExpired: false,
          },
          mustContainInSnippet: ['94,0', '28.08.2034'],
        },
      },
    },
  },

  // =========================================================================
  // FALL 08: MIETERLISTE MEHRFAMILIENHAUS MIT HANDSCHRIFTLICHER ERGÄNZUNG
  // =========================================================================
  {
    id: 'fall-08-mieterliste-handschrift',
    name: 'Fall 08: MFH-Mieterliste (30 Einheiten, handschriftliche Nachträge & Arithmetik)',
    description:
      'Gedruckte Tabelle über 28 Mietparteien (17.805,00 EUR) plus handschriftliche Einheiten 29 (Kowalski, 580 EUR) und 30 (Öztürk, 740 EUR). Rechnerische Gesamt-Nettomiete: 19.125,00 EUR mtl. / 229.500,00 EUR jährl.',
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [
      loadTestAktenFile('fall-08-mieterliste-handschrift', 'Mieterliste_Objekt_Lindenthal.pdf'),
    ],
    notes: 'Hausverwaltung hat aktuelle Mietübersicht eingereicht.',
    groundTruth: {
      expectedOverallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        mietverhaeltnisse: {
          expectedStatus: FIELD_STATUS.VERIFIED,
          expectedValues: {
            unitCount: 30,
            yearlyNetRent: 229500,
            fullRentedStatus: true,
            tenancyListAvailable: true,
          },
          mustContainInSnippet: ['19.125', '229.500'],
        },
      },
    },
  },
];
