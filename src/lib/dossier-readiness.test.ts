import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import {
  Dossier,
  FieldStatus,
  Inquiry,
  ImmobilienFields,
  FIELD_STATUS,
  INQUIRY_PRIORITY,
  INQUIRY_RECIPIENT,
} from '@/types/dossier';
import {
  isDossierEntwurfsreif,
  extractFieldObservations,
  parseSourceLocations,
  generatePruefberichtText,
} from './dossier';

function createMockDossier(
  fieldStatusMap: Partial<Record<keyof ImmobilienFields, FieldStatus>> = {},
  inquiries: Inquiry[] = []
): Dossier {
  const dossier = createTestImmobilienDossier({
    caseTitle: 'Test Vorgang 1001',
    executiveSummary: 'Alle Pflichtfelder vollständig geprüft.',
    fieldStatusMap,
    inquiries,
  });

  for (const [key, status] of Object.entries(fieldStatusMap)) {
    const fieldKey = key as keyof ImmobilienFields;
    if (dossier.fields[fieldKey] && status && status !== FIELD_STATUS.VERIFIED) {
      dossier.fields[fieldKey].note = `Prüfung für ${key} erforderlich`;
    }
  }

  return dossier;
}

describe('Notarielle Entwurfsreife & Prüfbericht-Logik', () => {
  it('sollte TRUE zurückgeben, wenn alle 10 Pflichtfelder VERIFIED sind und keine ungelöste kritische Nachforderung vorliegt', () => {
    const dossier = createMockDossier();
    expect(isDossierEntwurfsreif(dossier)).toBe(true);
  });

  it('sollte FALSE zurückgeben, wenn auch nur ein einziges Pflichtfeld NEEDS_REVIEW, OUTDATED oder MISSING ist', () => {
    const withReview = createMockDossier({ kaufpreis: FIELD_STATUS.NEEDS_REVIEW });
    expect(isDossierEntwurfsreif(withReview)).toBe(false);

    const withOutdated = createMockDossier({ energieausweis: FIELD_STATUS.OUTDATED });
    expect(isDossierEntwurfsreif(withOutdated)).toBe(false);

    const withMissing = createMockDossier({ kaeufer: FIELD_STATUS.MISSING });
    expect(isDossierEntwurfsreif(withMissing)).toBe(false);
  });

  it('sollte TRUE zurückgeben, wenn alle Felder VERIFIED sind (Option B: Nachforderungen blockieren nicht)', () => {
    const dossier = createMockDossier({}, [
      {
        id: 'inq-1',
        fieldKey: 'kaeufer',
        recipient: INQUIRY_RECIPIENT.MAKLER,
        priority: INQUIRY_PRIORITY.CRITICAL,
        subject: 'Handelsregisterauszug fehlt',
        message: 'Bitte reichen Sie den aktuellen Auszug ein.',
        justification: 'Nachweis der Vertretung zwingend erforderlich.',
        resolved: false,
      },
    ]);

    expect(isDossierEntwurfsreif(dossier)).toBe(true);
  });

  it('sollte TRUE zurückgeben, wenn alle Felder VERIFIED sind und eine ungelöste Nachforderung Priorität MEDIUM oder HIGH hat', () => {
    const dossier = createMockDossier({}, [
      {
        id: 'inq-2',
        fieldKey: 'energieausweis',
        recipient: INQUIRY_RECIPIENT.MAKLER,
        priority: INQUIRY_PRIORITY.MEDIUM,
        subject: 'Hinweis zu Ausweis',
        message: 'Bitte Baujahr prüfen.',
        justification: 'Optional.',
        resolved: false,
      },
    ]);

    expect(isDossierEntwurfsreif(dossier)).toBe(true);
  });
});

describe('Feststellungs-Extraktion & Audit-Trail Parsing', () => {
  it('sollte alle problematischen Felder extrahieren und sortiert nach Feldindex ausgeben', () => {
    const dossier = createMockDossier({
      kaufpreis: FIELD_STATUS.NEEDS_REVIEW,
      energieausweis: FIELD_STATUS.OUTDATED,
    });

    const observations = extractFieldObservations(dossier);
    expect(observations.length).toBe(2);

    expect(observations[0]?.fieldKey).toBe('kaufpreis');
    expect(observations[0]?.fieldIndex).toBe(5);
    expect(observations[0]?.status).toBe(FIELD_STATUS.NEEDS_REVIEW);

    expect(observations[1]?.fieldKey).toBe('energieausweis');
    expect(observations[1]?.fieldIndex).toBe(9);
    expect(observations[1]?.status).toBe(FIELD_STATUS.OUTDATED);
  });

  it('sollte kombinierte Quellenangaben mit Trennzeichen (+, ;, und) korrekt parsen', () => {
    const source1 = { fileName: 'Notiz #1 + grundbuch.pdf', pageNumber: 3, snippet: 'Zitat A' };
    const parsed1 = parseSourceLocations(source1);
    expect(parsed1.length).toBe(2);
    expect(parsed1[0]?.fileName).toBe('Notiz #1');
    expect(parsed1[1]?.fileName).toBe('grundbuch.pdf');

    const source2 = { fileName: 'DocA; DocB; DocA', pageNumber: 1, snippet: 'Zitat B' };
    const parsed2 = parseSourceLocations(source2);
    // Duplikate müssen eliminiert werden
    expect(parsed2.length).toBe(2);
    expect(parsed2.map((p) => p.fileName)).toEqual(['DocA', 'DocB']);
  });

  it('sollte einen formatierten Prüfbericht-Text mit allen Feststellungen generieren', () => {
    const dossier = createMockDossier({ kaufpreis: FIELD_STATUS.NEEDS_REVIEW });
    const text = generatePruefberichtText(dossier);

    expect(text).toContain('PRÜFBERICHT & FESTSTELLUNGEN');
    expect(text).toContain('Status: PRÜFUNGSBEDARF');
    expect(text).toContain('Kaufpreis');
    expect(text).toContain('Prüfung für kaufpreis erforderlich');
  });
});
