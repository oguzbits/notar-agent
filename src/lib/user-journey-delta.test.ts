import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import {
  Dossier,
  FIELD_STATUS,
  OVERALL_STATUS,
  DOCUMENT_RELIABILITY,
  INQUIRY_PRIORITY,
  INQUIRY_RECIPIENT,
} from '@/types/dossier';
import { normalizeDossier } from './dossier';

function createBaseDossier(): Dossier {
  return createTestImmobilienDossier({
    caseTitle: 'Vorgang 2001',
    analysisTimestamp: '2026-09-01T10:00:00.000Z',
    overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
    executiveSummary: 'Erstanalyse mit offenen Nachforderungen.',
    userNotes: ['Erstes Anschreiben mit Vorangebot 400.000 EUR.'],
    fieldStatusMap: {
      kaeufer: FIELD_STATUS.NEEDS_REVIEW,
      energieausweis: FIELD_STATUS.OUTDATED,
    },
    fields: {
      kaeufer: {
        note: 'Handelsregisterauszug noch nicht vorgelegt.',
      },
      kaufpreis: {
        data: {
          previousOffers: [380000],
          priceEvolutionSummary: 'Nachverhandlung',
        },
      },
      energieausweis: {
        data: {
          validUntil: '2020-01-01',
          isExpired: true,
        },
      },
    },
    detectedDocuments: [
      {
        fileName: 'Notiz #1',
        documentType: 'Bearbeitungsvermerk / Notiz',
        date: '2026-09-01',
        pageCount: 1,
        reliability: DOCUMENT_RELIABILITY.LOW,
        summary: 'Erstes Anschreiben mit Vorangebot 400.000 EUR.',
      },
      {
        fileName: 'urkunde_alt.pdf',
        documentType: 'Urkunde',
        date: '2015-05-10',
        pageCount: 4,
        reliability: DOCUMENT_RELIABILITY.HIGH,
      },
    ],
    inquiries: [
      {
        id: 'inq-1',
        fieldKey: 'kaeufer',
        recipient: INQUIRY_RECIPIENT.MAKLER,
        priority: INQUIRY_PRIORITY.CRITICAL,
        subject: 'Handelsregisterauszug fehlt',
        message: 'Bitte einreichen.',
        justification: 'Nachweis erforderlich.',
        resolved: false,
      },
    ],
  });
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
    expect(noteDocs[0]?.fileName).toBe('Notiz #1');
    expect(noteDocs[1]?.fileName).toBe('Notiz #2');
    expect(noteDocs[1]?.summary).toBe(newNoteText);

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
