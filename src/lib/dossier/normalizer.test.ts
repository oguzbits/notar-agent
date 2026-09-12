import { describe, it, expect } from 'vitest';
import {
  Dossier,
  ImmobilienDossier,
  ImmobilienFields,
  NotaryNumberSchema,
  KaufpreisDataSchema,
} from '@/types/dossier';
import { normalizeDossier } from './normalizer';

describe('Dossier Normalization & Integrity Guardrails', () => {
  it('should preserve canonical field data and ensure correct document sorting and normalization', () => {
    // Testet, dass kanonische Felder intakt bleiben und Notizen in detectedDocuments vorangestellt werden
    const rawDossier = {
      caseType: 'IMMOBILIENKAUF' as const,
      caseTitle: 'Synthetischer Testvorgang',
      analysisTimestamp: new Date().toISOString(),
      detectedDocuments: [
        {
          fileName: 'grundbuch.pdf',
          documentType: 'Grundbuchauszug',
          date: '2024-01-01',
          pageCount: 2,
          reliability: 'HIGH' as const,
          summary: 'Grundbuchauszug',
        },
      ],
      inquiries: [],
      overallStatus: 'ACTION_REQUIRED' as const,
      executiveSummary: 'Synthetischer Test',
      status: 'NEEDS_REVIEW' as const,
      source: { fileName: '', pageNumber: 0, snippet: '' },
      note: '',
      data: {},
      fields: {
        kaufpreis: {
          status: 'VERIFIED' as const,
          data: {
            amountInFigures: 500000,
            amountInWords: 'Fünfhunderttausend Euro',
          },
          source: {
            fileName: 'Notiz #1',
            pageNumber: 0,
            snippet: '500.000 EUR',
          },
          note: '',
        },
        grundbuch: {
          status: 'NEEDS_REVIEW' as const,
          data: {
            blatt: '9999',
            standDatum: '2020-01-01',
            grundbuchBezirk: 'Musterbezirk',
          },
          source: { fileName: 'grundbuch.pdf', pageNumber: 0, snippet: 'Blatt 9999' },
          note: '',
        },
      },
    };

    const normalized = normalizeDossier(rawDossier as unknown as Dossier);
    const fields = (normalized as unknown as ImmobilienDossier).fields;

    // Kanonische Felder bleiben exakt erhalten
    expect(fields.kaufpreis.data.amountInFigures).toBe(500000);
    expect(fields.kaufpreis.data.amountInWords).toBe('Fünfhunderttausend Euro');
    expect(fields.grundbuch.data.blatt).toBe('9999');

    // Quellennamen bleiben standardisiert
    expect(fields.kaufpreis.source.fileName).toBe('Notiz #1');

    // Notiz wurde an erster Stelle der Dokumentenliste eingefügt
    expect(normalized.detectedDocuments[0].fileName).toBe('Notiz #1');
    expect(normalized.detectedDocuments[1].fileName).toBe('grundbuch.pdf');
  });

  it('should STRICTLY downgrade VERIFIED to NEEDS_REVIEW when key data values are empty', () => {
    // Ein Feld darf NIEMALS als VERIFIED ("Belegt") gelten, wenn die eigentlichen Datenwerte fehlen!
    const rawDossier = {
      caseType: 'IMMOBILIENKAUF' as const,
      caseTitle: 'Test Vorgang',
      analysisTimestamp: new Date().toISOString(),
      detectedDocuments: [],
      inquiries: [],
      overallStatus: 'READY' as const,
      executiveSummary: 'Test',
      fields: {
        kaufpreis: {
          status: 'VERIFIED' as const, // Modell behauptet belegt
          data: {
            amountInFigures: 0, // aber kein Betrag vorhanden!
            amountInWords: '',
          },
          source: { fileName: 'Notiz #1', pageNumber: 0, snippet: '' },
          note: '',
        },
        verkaeufer: {
          status: 'VERIFIED' as const,
          data: {
            name: '', // kein Name!
            legalForm: '',
            registeredOwnersGrundbuch: [],
            authorizedRepresentatives: [],
            representationProofProvided: false,
            missingProofs: [],
          },
          source: { fileName: '', pageNumber: 0, snippet: '' },
          note: '',
        },
      } as unknown as ImmobilienFields,
    };

    const normalized = normalizeDossier(rawDossier as unknown as Dossier);
    const fields = (normalized as ImmobilienDossier).fields;
    expect(fields.kaufpreis.status).toBe('NEEDS_REVIEW');
    expect(fields.kaufpreis.note).toContain('Angaben unvollständig');

    expect(fields.verkaeufer.status).toBe('NEEDS_REVIEW');
    expect(fields.verkaeufer.note).toContain('Angaben unvollständig');
  });

  it('should downgrade verkaeufer to NEEDS_REVIEW when acting seller does not match registered owner without proof', () => {
    const rawDossier = {
      caseType: 'IMMOBILIENKAUF' as const,
      caseTitle: 'Erbfall Test',
      analysisTimestamp: new Date().toISOString(),
      detectedDocuments: [],
      inquiries: [],
      overallStatus: 'READY' as const,
      executiveSummary: 'Test',
      fields: {
        verkaeufer: {
          status: 'VERIFIED' as const,
          data: {
            name: 'Hans Müller (Erbe)',
            legalForm: 'natürliche Person',
            registeredOwnersGrundbuch: ['Karl Müller (Erblasser)'],
            authorizedRepresentatives: [],
            representationProofProvided: false, // Kein Erbschein / Vollmacht im Akt
            missingProofs: ['Erbschein'],
          },
          source: { fileName: 'grundbuch.pdf', pageNumber: 1, snippet: 'Eigentümer: Karl Müller' },
          note: '',
        },
      } as unknown as ImmobilienFields,
    };

    const normalized = normalizeDossier(rawDossier as unknown as Dossier);
    const fields = (normalized as ImmobilienDossier).fields;
    expect(fields.verkaeufer.status).toBe('NEEDS_REVIEW');
    expect(fields.verkaeufer.note).toContain('Erbnachweis (§ 35 GBO) oder Vollmacht erforderlich');
  });

  it('should downgrade corporate parties to NEEDS_REVIEW when official register proof is missing', () => {
    const rawDossier = {
      caseType: 'IMMOBILIENKAUF' as const,
      caseTitle: 'GmbH Register Test',
      analysisTimestamp: new Date().toISOString(),
      detectedDocuments: [],
      inquiries: [],
      overallStatus: 'READY' as const,
      executiveSummary: 'Test',
      fields: {
        kaeufer: {
          status: 'VERIFIED' as const,
          data: {
            companyName: 'Invest GmbH',
            legalForm: 'GmbH',
            registerCourt: 'AG München',
            registerNumber: 'HRB 12345',
            address: 'München',
            authorizedRepresentatives: ['Geschäftsführer'],
            hasOfficialRegisterProof: false, // Kein amtlicher Registerauszug vorgelegt!
          },
          source: { fileName: 'expose.pdf', pageNumber: 1, snippet: 'Invest GmbH' },
          note: '',
        },
      } as unknown as ImmobilienFields,
    };

    const normalized = normalizeDossier(rawDossier as unknown as Dossier);
    const fields = (normalized as ImmobilienDossier).fields;
    expect(fields.kaeufer.status).toBe('NEEDS_REVIEW');
    expect(fields.kaeufer.note).toContain('Amtlicher Registerauszug der Käufergesellschaft fehlt');
  });

  it('should transform formatted string numbers like currency and square meters to valid numbers', () => {
    // 1. Direkte Schema-Tests für NotaryNumberSchema
    expect(NotaryNumberSchema.parse('500.000,00 €')).toBe(500000);
    expect(NotaryNumberSchema.parse('500.000')).toBe(500000);
    expect(NotaryNumberSchema.parse('1.250.000,50 EUR')).toBe(1250000.5);
    expect(NotaryNumberSchema.parse('145 m²')).toBe(145);
    expect(NotaryNumberSchema.parse('85,5 m2')).toBe(85.5);
    expect(NotaryNumberSchema.parse('112,4 kWh/(m²*a)')).toBe(112.4);
    expect(NotaryNumberSchema.parse(500000)).toBe(500000);
    expect(NotaryNumberSchema.parse('')).toBe(0);

    // 2. KaufpreisDataSchema Validierung mit formatiertem String
    const parsedKaufpreis = KaufpreisDataSchema.safeParse({
      amountInFigures: '750.000,00 €',
      amountInWords: 'Siebenhundertfünfzigtausend Euro',
      currency: 'EUR',
      previousOffers: ['700.000 €', '720.000,00'],
      priceEvolutionSummary: 'Verhandlung',
      isFinalAgreedPrice: true,
    });

    expect(parsedKaufpreis.success).toBe(true);
    if (parsedKaufpreis.success) {
      expect(parsedKaufpreis.data.amountInFigures).toBe(750000);
      expect(parsedKaufpreis.data.previousOffers).toEqual([700000, 720000]);
    }
  });
});
