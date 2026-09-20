import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import {
  ImmobilienDossier,
  NotaryNumberSchema,
  KaufpreisDataSchema,
  FIELD_STATUS,
  OVERALL_STATUS,
  DOCUMENT_RELIABILITY,
  NOTAR_DOCUMENT_TYPES,
} from '@/types/dossier';
import { normalizeDossier } from './normalizer';

describe('Dossier Normalization & Integrity Guardrails', () => {
  it('should preserve canonical field data and ensure correct document sorting and normalization', () => {
    // Testet, dass kanonische Felder intakt bleiben und Notizen in detectedDocuments vorangestellt werden
    const testDossier = createTestImmobilienDossier({
      caseTitle: 'Synthetischer Testvorgang',
      detectedDocuments: [
        {
          fileName: 'grundbuch.pdf',
          documentType: NOTAR_DOCUMENT_TYPES.GRUNDBUCHAUSZUG,
          date: '2024-01-01',
          pageCount: 2,
          reliability: DOCUMENT_RELIABILITY.HIGH,
          summary: NOTAR_DOCUMENT_TYPES.GRUNDBUCHAUSZUG,
        },
      ],
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      executiveSummary: 'Synthetischer Test',
      fields: {
        kaufpreis: {
          status: FIELD_STATUS.VERIFIED,
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
          status: FIELD_STATUS.NEEDS_REVIEW,
          data: {
            blatt: '9999',
            standDatum: '2020-01-01',
            grundbuchBezirk: 'Musterbezirk',
          },
          source: { fileName: 'grundbuch.pdf', pageNumber: 0, snippet: 'Blatt 9999' },
          note: '',
        },
      },
    });

    const normalized = normalizeDossier(testDossier) as ImmobilienDossier;
    const fields = normalized.fields;

    // Kanonische Felder bleiben exakt erhalten
    expect(fields.kaufpreis.data.amountInFigures).toBe(500000);
    expect(fields.kaufpreis.data.amountInWords).toBe('Fünfhunderttausend Euro');
    expect(fields.grundbuch.data.blatt).toBe('9999');

    // Quellennamen bleiben standardisiert
    expect(fields.kaufpreis.source.fileName).toBe('Notiz #1');
    expect(fields.grundbuch.source.fileName).toBe('grundbuch.pdf');

    // Notizen werden in detectedDocuments einsortiert (Notiz #1 an erster Stelle)
    expect(normalized.detectedDocuments.length).toBe(2);
    expect(normalized.detectedDocuments[0]?.fileName).toBe('Notiz #1');
    expect(normalized.detectedDocuments[0]?.documentType).toBe(
      NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ
    );
    expect(normalized.detectedDocuments[1]?.fileName).toBe('grundbuch.pdf');
  });

  it('should resiliently parse notary number strings with german formatting and symbols', () => {
    expect(NotaryNumberSchema.parse('500.000,00 €')).toBe(500000);
    expect(NotaryNumberSchema.parse('1.250.000,50 EUR')).toBe(1250000.5);
    expect(NotaryNumberSchema.parse('120 m²')).toBe(120);
    expect(NotaryNumberSchema.parse(250000)).toBe(250000);
    expect(NotaryNumberSchema.parse('   ')).toBe(0);

    const parsedKaufpreis = KaufpreisDataSchema.parse({
      amountInFigures: '750.000 €',
      amountInWords: 'Siebenhundertfünfzigtausend Euro',
      currency: 'EUR',
      previousOffers: [],
      priceEvolutionSummary: 'Einigung erzielt',
      isFinalAgreedPrice: true,
    });
    expect(parsedKaufpreis.amountInFigures).toBe(750000);
  });

  it('should downgrade empty or incomplete fields from VERIFIED to NEEDS_REVIEW', () => {
    const testDossier = createTestImmobilienDossier({
      fields: {
        kaufpreis: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            amountInFigures: 0, // kein Betrag!
            amountInWords: '',
          },
          source: { fileName: '', pageNumber: 0, snippet: '' },
          note: '',
        },
        verkaeufer: {
          status: FIELD_STATUS.VERIFIED,
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
      },
    });

    const normalized = normalizeDossier(testDossier) as ImmobilienDossier;
    const fields = normalized.fields;
    expect(fields.kaufpreis.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(fields.kaufpreis.note).toContain('Angaben unvollständig');

    expect(fields.verkaeufer.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(fields.verkaeufer.note).toContain('Angaben unvollständig');
  });

  it('should downgrade verkaeufer to NEEDS_REVIEW when acting seller does not match registered owner without proof', () => {
    const testDossier = createTestImmobilienDossier({
      caseTitle: 'Erbfall Test',
      fields: {
        verkaeufer: {
          status: FIELD_STATUS.VERIFIED,
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
      },
    });

    const normalized = normalizeDossier(testDossier) as ImmobilienDossier;
    const fields = normalized.fields;
    expect(fields.verkaeufer.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(fields.verkaeufer.note).toContain(
      'Nachweis der Verfügungsbefugnis oder Erbnachweis erforderlich'
    );
  });

  it('should downgrade corporate parties to NEEDS_REVIEW when official register proof is missing', () => {
    const testDossier = createTestImmobilienDossier({
      caseTitle: 'GmbH Register Test',
      fields: {
        kaeufer: {
          status: FIELD_STATUS.VERIFIED,
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
      },
    });

    const normalized = normalizeDossier(testDossier) as ImmobilienDossier;
    const fields = normalized.fields;
    expect(fields.kaeufer.status).toBe(FIELD_STATUS.NEEDS_REVIEW);
    expect(fields.kaeufer.note).toContain('Amtlicher Registerauszug der Käufergesellschaft fehlt');
  });

  it('property-based fuzzing: NotaryNumberSchema never throws unhandled exceptions on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (arbitraryInput: string) => {
        // NotaryNumberSchema darf niemals ungefangen abstürzen
        expect(() => NotaryNumberSchema.safeParse(arbitraryInput)).not.toThrow();
      }),
      { numRuns: 1000 }
    );
  });

  it('guarantees deterministic date injection via referenceDate', () => {
    const testDossier = createTestImmobilienDossier({
      analysisTimestamp: '',
      userNotes: ['Wichtige Notiz vom Sachbearbeiter'],
    });

    const fixedDate = new Date('2025-05-15T10:00:00.000Z');
    const normalized = normalizeDossier(testDossier, { referenceDate: fixedDate });

    const noteDoc = normalized.detectedDocuments.find((d) => d.fileName === 'Notiz #1');
    expect(noteDoc).toBeDefined();
    expect(noteDoc?.date).toBe('2025-05-15');
  });
});
