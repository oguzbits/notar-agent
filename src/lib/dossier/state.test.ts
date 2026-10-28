import { describe, it, expect } from 'vitest';
import { STATUS_OVERRIDE_TEXTS_DE } from '@/lib/dossier/constants';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { Dossier, FIELD_STATUS, OVERALL_STATUS, isImmobilienDossier } from '@/types/dossier';
import {
  carryOverReviews,
  confirmField,
  checkStatusOverride,
  getDossierFieldsRecord,
  updateDossierFieldStatus,
} from './state';

describe('Dossier State & Mutations (state.ts)', () => {
  it('liefert das typisierte fields-Dictionary zurück', () => {
    const dossier = createTestImmobilienDossier();
    const fields = getDossierFieldsRecord(dossier);

    expect(fields).toBeDefined();
    expect(fields.verkaeufer).toBeDefined();
    expect(fields.kaeufer).toBeDefined();
  });

  it('erzeugt eine unveränderliche Kopie mit aktualisiertem Feld-Status', () => {
    const original = createTestImmobilienDossier({
      fieldStatusMap: {
        kaeufer: FIELD_STATUS.MISSING,
      },
    });

    const updated = updateDossierFieldStatus(
      original,
      'kaeufer',
      FIELD_STATUS.VERIFIED,
      'Prüfung erfolgreich abgeschlossen'
    );

    expect(original.fields.kaeufer.status).toBe(FIELD_STATUS.MISSING);
    expect(isImmobilienDossier(updated)).toBe(true);
    if (isImmobilienDossier(updated)) {
      expect(updated.fields.kaeufer.status).toBe(FIELD_STATUS.VERIFIED);
      expect(updated.fields.kaeufer.note).toBe('Prüfung erfolgreich abgeschlossen');
    }
  });

  it('setzt overallStatus auf READY wenn alle Felder VERIFIED sind', () => {
    const allVerifiedStatusMap = {
      verkaeufer: FIELD_STATUS.VERIFIED,
      kaeufer: FIELD_STATUS.VERIFIED,
      grundbuch: FIELD_STATUS.VERIFIED,
      grundstuecke: FIELD_STATUS.VERIFIED,
      kaufpreis: FIELD_STATUS.VERIFIED,
      finanzierung: FIELD_STATUS.VERIFIED,
      belastungen: FIELD_STATUS.VERIFIED,
      mietverhaeltnisse: FIELD_STATUS.VERIFIED,
      energieausweis: FIELD_STATUS.VERIFIED,
      uebergabe: FIELD_STATUS.MISSING,
    };

    const almostReady = createTestImmobilienDossier({
      overallStatus: OVERALL_STATUS.ACTION_REQUIRED,
      fieldStatusMap: allVerifiedStatusMap,
    });

    const ready = updateDossierFieldStatus(almostReady, 'uebergabe', FIELD_STATUS.VERIFIED);

    expect(ready.overallStatus).toBe(OVERALL_STATUS.READY);
  });

  describe('Statuswechsel erkennen (checkStatusOverride ohne Begründung)', () => {
    const hasFieldStatusChange = (a: Dossier, b: Dossier) =>
      checkStatusOverride(a, b, undefined).requiresOverride;

    it('erkennt die Änderung eines Feldstatus', () => {
      const before = createTestImmobilienDossier({
        fieldStatusMap: { verkaeufer: FIELD_STATUS.NEEDS_REVIEW },
      });
      const after = updateDossierFieldStatus(before, 'verkaeufer', FIELD_STATUS.VERIFIED);

      expect(hasFieldStatusChange(before, after)).toBe(true);
    });

    it('ignoriert Änderungen ohne Statuswechsel (z. B. nur Notiz)', () => {
      const before = createTestImmobilienDossier();
      const status = getDossierFieldsRecord(before).verkaeufer?.status ?? FIELD_STATUS.NEEDS_REVIEW;
      const after = updateDossierFieldStatus(before, 'verkaeufer', status, 'Nur eine Notiz');

      expect(hasFieldStatusChange(before, after)).toBe(false);
    });

    it('erkennt ein entferntes Feld als Statuswechsel', () => {
      const before = createTestImmobilienDossier();
      const after = structuredClone(before);
      delete (after.fields as Record<string, unknown>).verkaeufer;

      expect(hasFieldStatusChange(before, after)).toBe(true);
    });
  });

  describe('checkStatusOverride', () => {
    const stored = createTestImmobilienDossier({
      fieldStatusMap: { verkaeufer: FIELD_STATUS.NEEDS_REVIEW, kaeufer: FIELD_STATUS.MISSING },
    });
    const claim = {
      fieldKey: 'verkaeufer',
      previousStatus: FIELD_STATUS.VERIFIED,
      newStatus: FIELD_STATUS.VERIFIED,
      reason: 'Original lag vor',
    };
    const changeVerkaeufer = updateDossierFieldStatus(stored, 'verkaeufer', FIELD_STATUS.VERIFIED);

    it('ohne Statuswechsel und ohne Begründung: kein Override nötig', () => {
      expect(checkStatusOverride(stored, structuredClone(stored), undefined)).toEqual({
        requiresOverride: false,
      });
    });

    it('Statuswechsel ohne Begründung wird abgelehnt', () => {
      expect(checkStatusOverride(stored, changeVerkaeufer, undefined).error).toBe(
        STATUS_OVERRIDE_TEXTS_DE.REASON_REQUIRED
      );
    });

    it('Begründung für Feld A, aber zusätzlich Feld B geändert: abgelehnt', () => {
      const both = updateDossierFieldStatus(changeVerkaeufer, 'kaeufer', FIELD_STATUS.VERIFIED);

      expect(checkStatusOverride(stored, both, claim).error).toBe(
        STATUS_OVERRIDE_TEXTS_DE.MISMATCH
      );
    });

    it('Begründung mit anderem Zielstatus als der echte Wechsel: abgelehnt', () => {
      const claimOutdated = { ...claim, newStatus: FIELD_STATUS.OUTDATED };

      expect(checkStatusOverride(stored, changeVerkaeufer, claimOutdated).error).toBe(
        STATUS_OVERRIDE_TEXTS_DE.MISMATCH
      );
    });

    it('Begründung ohne echten Wechsel: abgelehnt', () => {
      expect(checkStatusOverride(stored, structuredClone(stored), claim).error).toBe(
        STATUS_OVERRIDE_TEXTS_DE.MISMATCH
      );
    });

    it('passende Begründung: bisheriger Status kommt aus dem gespeicherten Stand', () => {
      expect(checkStatusOverride(stored, changeVerkaeufer, claim)).toEqual({
        requiresOverride: true,
        override: { ...claim, previousStatus: FIELD_STATUS.NEEDS_REVIEW },
      });
    });
  });
});

describe('Prüfvermerk je Feld', () => {
  const review = { confirmedAt: '2026-10-17T10:00:00.000Z', confirmedBy: 'Notar A' };
  const verified = () =>
    createTestImmobilienDossier({ fieldStatusMap: { verkaeufer: FIELD_STATUS.VERIFIED } });
  const seller = (d: Dossier) => {
    const field = getDossierFieldsRecord(d).verkaeufer;
    if (!field) throw new Error('Testdossier ohne verkaeufer');
    return field;
  };

  it('setzt den Vermerk nur bei Status VERIFIED und lehnt andere ab', () => {
    const dossier = createTestImmobilienDossier({
      fieldStatusMap: { kaeufer: FIELD_STATUS.NEEDS_REVIEW, verkaeufer: FIELD_STATUS.VERIFIED },
    });
    expect(() => confirmField(dossier, 'kaeufer', review)).toThrow();
    expect(() => confirmField(dossier, 'gibtEsNicht', review)).toThrow();
    expect(seller(confirmField(dossier, 'verkaeufer', review)).review).toEqual(review);
    expect(seller(dossier).review).toBeUndefined();
  });

  it('behält den Vermerk bei unverändertem Feld, verwirft ihn bei geänderten Daten, Quelle oder Status', () => {
    const base = confirmField(verified(), 'verkaeufer', review);
    expect(seller(carryOverReviews(base, structuredClone(base))).review).toEqual(review);

    const data = structuredClone(base);
    seller(data).data = { ...seller(data).data, name: 'Anderer' };
    expect(seller(carryOverReviews(base, data)).review).toBeUndefined();

    const source = structuredClone(base);
    seller(source).source = { ...seller(source).source, pageNumber: 99 };
    expect(seller(carryOverReviews(base, source)).review).toBeUndefined();

    const status = structuredClone(base);
    seller(status).status = FIELD_STATUS.NEEDS_REVIEW;
    expect(seller(carryOverReviews(base, status)).review).toBeUndefined();
  });

  it('behält den Vermerk auch bei anderer Schlüsselreihenfolge der Daten', () => {
    const base = confirmField(verified(), 'verkaeufer', review);
    const reordered = structuredClone(base);
    seller(reordered).data = Object.fromEntries(Object.entries(seller(base).data).reverse());
    expect(seller(carryOverReviews(base, reordered)).review).toEqual(review);
  });

  it('übernimmt keinen vom Client mitgeschickten Vermerk', () => {
    const stored = verified();
    const forged = structuredClone(stored);
    seller(forged).review = review;
    expect(seller(carryOverReviews(stored, forged)).review).toBeUndefined();
    expect(seller(carryOverReviews(undefined, forged)).review).toBeUndefined();
  });
});
