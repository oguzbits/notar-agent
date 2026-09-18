import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { FIELD_STATUS, OVERALL_STATUS, isImmobilienDossier } from '@/types/dossier';
import { getDossierFieldsRecord, updateDossierFieldStatus } from './state';

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
});
