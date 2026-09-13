import { describe, it, expect } from 'vitest';
import { createEmptyImmobilienFields } from '@/lib/dossier-defaults';
import {
  CASE_TYPES,
  OVERALL_STATUS,
  FIELD_STATUS,
  INQUIRY_PRIORITY,
  INQUIRY_RECIPIENT,
  DOCUMENT_RELIABILITY,
  Dossier,
  isImmobilienDossier,
} from '@/types/dossier';
import { mergeDossierStages } from './dossier-merger';

describe('dossier-merger', () => {
  it('merges Stage 1 extraction fields into default empty dossier structure', () => {
    const stage1Extraction = {
      caseTitle: 'Kaufvertrag Testweg 12, München',
      executiveSummary: 'Erster Entwurf liegt vor. Finanzierung ungeklärt.',
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      detectedDocuments: [
        {
          fileName: 'kaufvertragsentwurf.pdf',
          documentType: 'Kaufvertragsentwurf',
          date: '2026-03-01',
          pageCount: 1,
          reliability: DOCUMENT_RELIABILITY.HIGH,
        },
      ],
      fields: {
        kaufpreis: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            amountInFigures: 650000,
            currency: 'EUR',
            isFinalAgreedPrice: true,
          },
          source: {
            fileName: 'kaufvertragsentwurf.pdf',
            pageNumber: 1,
            snippet: 'Der Kaufpreis beträgt EUR 650.000,00',
          },
          note: 'Kaufpreis klar beziffert.',
          actionRequired: 'false',
        },
      },
      inquiries: [
        {
          id: 'inq-1',
          recipient: INQUIRY_RECIPIENT.KAEUFER,
          fieldKey: 'finanzierung',
          priority: INQUIRY_PRIORITY.HIGH,
          subject: 'Finanzierungsbestätigung fehlt',
          message: 'Bitte reichen Sie die Finanzierungszusage der Bank ein.',
        },
      ],
    };

    const dossier = mergeDossierStages({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      parsedExtractionRaw: stage1Extraction,
      parsedAuditorModifications: {},
    });

    expect(dossier.caseType).toBe(CASE_TYPES.IMMOBILIENKAUF);
    expect(dossier.caseTitle).toBe('Kaufvertrag Testweg 12, München');
    expect(dossier.executiveSummary).toBe('Erster Entwurf liegt vor. Finanzierung ungeklärt.');
    expect(dossier.overallStatus).toBe(OVERALL_STATUS.ACTION_REQUIRED);
    expect(dossier.detectedDocuments).toHaveLength(1);

    expect(isImmobilienDossier(dossier)).toBe(true);
    if (!isImmobilienDossier(dossier)) return;

    // Verifiziertes Feld aus Stage 1
    const kaufpreisField = dossier.fields.kaufpreis;
    expect(kaufpreisField.status).toBe(FIELD_STATUS.VERIFIED);
    expect(kaufpreisField.data.amountInFigures).toBe(650000);
    expect(kaufpreisField.source?.snippet).toContain('650.000,00');

    // Unberührte Pflichtfelder bleiben im Standardzustand (MISSING / NOT_FOUND)
    expect(dossier.fields.verkaeufer.status).toBe(FIELD_STATUS.MISSING);

    // Inquiries normalisiert
    expect(dossier.inquiries).toHaveLength(1);
    expect(dossier.inquiries[0]?.recipient).toBe(INQUIRY_RECIPIENT.KAEUFER);
    expect(dossier.inquiries[0]?.priority).toBe(INQUIRY_PRIORITY.HIGH);
  });

  it('applies Stage 2 auditor delta modifications over Stage 1 fields', () => {
    const stage1Extraction = {
      caseTitle: 'Entwurf Test',
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fields: {
        grundbuch: {
          status: FIELD_STATUS.NEEDS_REVIEW,
          data: {
            amtsgericht: 'Amtsgericht München',
            grundbuchblatt: '1234',
          },
          note: 'Wohnungsrecht in Abteilung II unklar',
          actionRequired: 'true',
        },
      },
    };

    // Stufe 2 Auditor korrigiert das Feld gezielt
    const auditorModifications = {
      grundbuch: {
        status: FIELD_STATUS.VERIFIED,
        data: {
          isCurrent: true,
        },
        note: 'Löschungsbewilligung für Abteilung II wurde in Anlage B bestätigt.',
        actionRequired: 'false',
      },
    };

    const dossier = mergeDossierStages({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      parsedExtractionRaw: stage1Extraction,
      parsedAuditorModifications: auditorModifications,
      auditorOverallStatus: OVERALL_STATUS.READY,
      auditorExecutiveSummary: 'Reconciliation erfolgreich: Alle Punkte bereinigt.',
    });

    expect(dossier.overallStatus).toBe(OVERALL_STATUS.READY);
    expect(dossier.executiveSummary).toBe('Reconciliation erfolgreich: Alle Punkte bereinigt.');

    expect(isImmobilienDossier(dossier)).toBe(true);
    if (!isImmobilienDossier(dossier)) return;

    const gbField = dossier.fields.grundbuch;
    expect(gbField.status).toBe(FIELD_STATUS.VERIFIED);
    // Data aus Stage 1 und Stage 2 müssen zusammengeführt sein
    expect(gbField.data.amtsgericht).toBe('Amtsgericht München');
    expect(gbField.data.isCurrent).toBe(true);
    expect(gbField.note).toBe('Löschungsbewilligung für Abteilung II wurde in Anlage B bestätigt.');
    expect(gbField.actionRequired).toBe('false');
  });

  it('preserves and augments existing dossier documents and fields in delta/update mode', () => {
    const existingDossier: Dossier = {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      caseTitle: 'Vorgang Altbestand Az 99/2026',
      analysisTimestamp: '2026-02-01T10:00:00.000Z',
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      executiveSummary: 'Vorherige Teilanalyse',
      detectedDocuments: [
        {
          fileName: 'personalausweis_verkaeufer.pdf',
          documentType: 'Personalausweis',
          date: '2026-02-01',
          pageCount: 1,
          reliability: DOCUMENT_RELIABILITY.HIGH,
        },
      ],
      fields: {
        ...createEmptyImmobilienFields(),
        verkaeufer: {
          status: FIELD_STATUS.VERIFIED,
          data: {
            name: 'Erika Mustermann',
            legalForm: '',
            registeredOwnersGrundbuch: [],
            authorizedRepresentatives: [],
            representationProofProvided: true,
            missingProofs: [],
          },
          source: {
            fileName: 'personalausweis_verkaeufer.pdf',
            pageNumber: 1,
            snippet: 'Erika Mustermann',
          },
          note: '',
          actionRequired: 'false',
        },
      },
      inquiries: [],
    };

    const stage1Delta = {
      detectedDocuments: [
        {
          fileName: 'grundbuchauszug_neu.pdf',
          documentType: 'Grundbuchauszug',
          date: '2026-03-10',
          pageCount: 3,
          reliability: DOCUMENT_RELIABILITY.HIGH,
        },
      ],
      fields: {
        grundbuch: {
          status: FIELD_STATUS.VERIFIED,
          data: { blatt: '9988' },
          note: 'Nachgereicht',
          actionRequired: 'false',
        },
      },
    };

    const merged = mergeDossierStages({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      existingDossier,
      parsedExtractionRaw: stage1Delta,
      parsedAuditorModifications: {},
    });

    // Beide Dokumente müssen vorhanden sein (Altdokument wird bewahrt)
    expect(merged.detectedDocuments).toHaveLength(2);
    const fileNames = merged.detectedDocuments.map((d) => d.fileName);
    expect(fileNames).toContain('personalausweis_verkaeufer.pdf');
    expect(fileNames).toContain('grundbuchauszug_neu.pdf');

    expect(isImmobilienDossier(merged)).toBe(true);
    if (!isImmobilienDossier(merged)) return;

    // Altes Feld verkaeufer muss intakt bleiben
    expect(merged.fields.verkaeufer.data.name).toBe('Erika Mustermann');
    expect(merged.fields.verkaeufer.status).toBe(FIELD_STATUS.VERIFIED);

    // Neues Feld muss dazugekommen sein
    expect(merged.fields.grundbuch.data.blatt).toBe('9988');
  });

  it('normalizes invalid or partial inquiries into valid Inquiry items', () => {
    const rawExtraction = {
      inquiries: [
        {
          // unvollständiges Item ohne ID oder Priorität
          fieldKey: 'energieausweis',
          description: 'Energieausweis liegt noch nicht vor.',
        },
        {
          id: 'custom-inq-2',
          fieldKey: 'kaufpreis',
          recipient: INQUIRY_RECIPIENT.BANK,
          priority: 'INVALID_PRIORITY',
          subject: 'Treuhandauftrag',
          message: 'Ablösevollmacht fehlt.',
          resolved: true,
        },
      ],
    };

    const dossier = mergeDossierStages({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      parsedExtractionRaw: rawExtraction,
      parsedAuditorModifications: {},
    });

    expect(dossier.inquiries).toHaveLength(2);

    // Erstes Item: Auto-ID 'inq-1', Default Priority HIGH, Recipient Verkäufer
    expect(dossier.inquiries[0]?.id).toBe('inq-1');
    expect(dossier.inquiries[0]?.priority).toBe(INQUIRY_PRIORITY.HIGH);
    expect(dossier.inquiries[0]?.recipient).toBe(INQUIRY_RECIPIENT.VERKAEUFER);
    expect(dossier.inquiries[0]?.message).toBe('Energieausweis liegt noch nicht vor.');

    // Zweites Item: Ungültige Priorität fällt auf HIGH zurück, custom Felder bleiben
    expect(dossier.inquiries[1]?.id).toBe('custom-inq-2');
    expect(dossier.inquiries[1]?.priority).toBe(INQUIRY_PRIORITY.HIGH);
    expect(dossier.inquiries[1]?.recipient).toBe(INQUIRY_RECIPIENT.BANK);
    expect(dossier.inquiries[1]?.resolved).toBe(true);
  });

  it('falls back gracefully when Zod schema parsing encounters invalid payload structure', () => {
    // Ungültige Typen, die safeParse zum Fehlschlagen bringen
    const invalidExtraction: Record<string, unknown> = {
      caseTitle: 12345,
      fields: 'not-an-object',
      overallStatus: 'COMPLETELY_BOGUS_STATUS',
    };

    const dossier = mergeDossierStages({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      parsedExtractionRaw: invalidExtraction,
      parsedAuditorModifications: {},
    });

    expect(dossier.caseType).toBe(CASE_TYPES.IMMOBILIENKAUF);
    expect(dossier.overallStatus).toBe(OVERALL_STATUS.ACTION_REQUIRED);
    expect(dossier.caseTitle).toContain('Immobilienkauf');
    expect(dossier.fields).toBeDefined();
  });
});
