import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { CASE_TYPES, FIELD_STATUS, type FieldStatus } from '@/types/dossier';
import {
  getDossierFieldMetrics,
  getDossierReadinessStage,
  isDossierEntwurfsreif,
  READINESS_STAGES,
} from './readiness';

describe('Readiness Domain Service', () => {
  it('returns true for isDossierEntwurfsreif when all fields are verified', () => {
    const dossier = createTestImmobilienDossier();
    expect(isDossierEntwurfsreif(dossier)).toBe(true);
    expect(getDossierReadinessStage(dossier).stage).toBe(READINESS_STAGES.READY);
  });

  it('returns false for isDossierEntwurfsreif when a field is missing, but DRAFTING_POSSIBLE if core party/object fields are present', () => {
    const dossier = createTestImmobilienDossier({
      fieldStatusMap: { energieausweis: FIELD_STATUS.MISSING },
    });
    expect(isDossierEntwurfsreif(dossier)).toBe(false);
    expect(getDossierReadinessStage(dossier).stage).toBe(READINESS_STAGES.DRAFTING_POSSIBLE);
  });

  it('returns BLOCKED when essential party or object fields are missing', () => {
    const dossier = createTestImmobilienDossier({
      fieldStatusMap: {
        verkaeufer: FIELD_STATUS.MISSING,
        kaeufer: FIELD_STATUS.MISSING,
      },
    });
    expect(isDossierEntwurfsreif(dossier)).toBe(false);
    expect(getDossierReadinessStage(dossier).stage).toBe(READINESS_STAGES.BLOCKED);
  });
});

/**
 * Dossier mit frei wählbarer Vorgangsart und Feldern. `Object.assign` vermeidet Typ-Casts:
 * Der Schnitt aus abweichender Vorgangsart und Immobilien-Dossier ist `never` und damit als `Dossier` zulässig.
 */
function dossierWith(caseType: string | undefined, statuses: Record<string, FieldStatus | null>) {
  const template = createTestImmobilienDossier().fields.verkaeufer;
  const fields = Object.fromEntries(
    Object.entries(statuses).map(([key, status]) => [
      key,
      status === null ? undefined : { ...template, status },
    ])
  );
  return Object.assign(createTestImmobilienDossier(), { caseType, fields });
}

const { VERIFIED, MISSING, NEEDS_REVIEW } = FIELD_STATUS;
const UNKNOWN_CASE_TYPE = 'nicht-vorhanden';

describe('isDossierEntwurfsreif (Grenzfälle)', () => {
  it('ist false ohne Dossier, ohne Felder und bei leerem Feldverzeichnis', () => {
    // @ts-expect-error Laufzeitschutz gegen ein fehlendes Dossier
    expect(isDossierEntwurfsreif(null)).toBe(false);
    expect(
      isDossierEntwurfsreif(Object.assign(createTestImmobilienDossier(), { fields: undefined }))
    ).toBe(false);
    expect(isDossierEntwurfsreif(dossierWith(CASE_TYPES.IMMOBILIENKAUF, {}))).toBe(false);
  });

  it('ist false, sobald ein Feld fehlt oder leer ist, und wirft nicht', () => {
    expect(
      isDossierEntwurfsreif(dossierWith(CASE_TYPES.IMMOBILIENKAUF, { a: VERIFIED, b: null }))
    ).toBe(false);
    expect(
      isDossierEntwurfsreif(
        dossierWith(CASE_TYPES.IMMOBILIENKAUF, { a: VERIFIED, b: NEEDS_REVIEW })
      )
    ).toBe(false);
  });

  it('ist true, wenn alle vorhandenen Felder belegt sind', () => {
    expect(
      isDossierEntwurfsreif(dossierWith(CASE_TYPES.IMMOBILIENKAUF, { a: VERIFIED, b: VERIFIED }))
    ).toBe(true);
  });
});

describe('getDossierReadinessStage (Texte und Kerndaten)', () => {
  it('liefert die Texte je Stufe', () => {
    expect(getDossierReadinessStage(createTestImmobilienDossier())).toEqual({
      stage: READINESS_STAGES.READY,
      badgeLabel: 'Beurkundungsreif',
      description: 'Alle notariellen Pflichtfelder sind vollständig belegt.',
    });
    expect(
      getDossierReadinessStage(
        createTestImmobilienDossier({ fieldStatusMap: { energieausweis: MISSING } })
      )
    ).toEqual({
      stage: READINESS_STAGES.DRAFTING_POSSIBLE,
      badgeLabel: 'Entwurfserstellung möglich',
      description:
        'Wesentliche Vertragsdaten liegen vor. Begleitfragen können parallel geklärt werden.',
    });
    expect(
      getDossierReadinessStage(
        createTestImmobilienDossier({ fieldStatusMap: { verkaeufer: MISSING, kaeufer: MISSING } })
      )
    ).toEqual({
      stage: READINESS_STAGES.BLOCKED,
      badgeLabel: 'Nachforderung erforderlich',
      description: '',
    });
  });

  it.each([
    [
      'nur eine Partei belegt',
      { verkaeufer: VERIFIED, kaeufer: MISSING, kaufpreis: VERIFIED, grundbuch: MISSING },
      true,
    ],
    [
      'nur die andere Partei belegt',
      { verkaeufer: MISSING, kaeufer: VERIFIED, kaufpreis: MISSING, grundbuch: VERIFIED },
      true,
    ],
    [
      'Parteien ohne Objekt',
      { verkaeufer: VERIFIED, kaeufer: VERIFIED, kaufpreis: MISSING, grundbuch: NEEDS_REVIEW },
      false,
    ],
    [
      'Objekt ohne Parteien',
      { verkaeufer: MISSING, kaeufer: NEEDS_REVIEW, kaufpreis: VERIFIED, grundbuch: VERIFIED },
      false,
    ],
  ])('Immobilienkauf: %s', (_name, statuses, possible) => {
    const stage = getDossierReadinessStage(
      dossierWith(CASE_TYPES.IMMOBILIENKAUF, { ...statuses, sonst: MISSING })
    ).stage;
    expect(stage).toBe(possible ? READINESS_STAGES.DRAFTING_POSSIBLE : READINESS_STAGES.BLOCKED);
  });

  it('GmbH-Gründung prüft die Kernfelder ihrer Vorgangsart, nicht die des Immobilienkaufs', () => {
    const gmbh = { firma: VERIFIED, stammkapital: VERIFIED, unternehmensgegenstand: MISSING };
    expect(getDossierReadinessStage(dossierWith(CASE_TYPES.GMBH_GRUENDUNG, gmbh)).stage).toBe(
      READINESS_STAGES.DRAFTING_POSSIBLE
    );
    const nurImmobilienfelder = { verkaeufer: VERIFIED, kaufpreis: VERIFIED, firma: MISSING };
    expect(
      getDossierReadinessStage(dossierWith(CASE_TYPES.GMBH_GRUENDUNG, nurImmobilienfelder)).stage
    ).toBe(READINESS_STAGES.BLOCKED);
  });

  it('nimmt ohne oder mit unbekannter Vorgangsart die Kernfelder des Immobilienkaufs', () => {
    const felder = { verkaeufer: VERIFIED, kaufpreis: VERIFIED, sonst: MISSING };
    expect(getDossierReadinessStage(dossierWith(undefined, felder)).stage).toBe(
      READINESS_STAGES.DRAFTING_POSSIBLE
    );
    expect(getDossierReadinessStage(dossierWith(UNKNOWN_CASE_TYPE, felder)).stage).toBe(
      READINESS_STAGES.DRAFTING_POSSIBLE
    );
  });

  it('meldet fehlende Felder und fehlende Feldeinträge als Nachforderung, ohne zu werfen', () => {
    expect(
      getDossierReadinessStage(Object.assign(createTestImmobilienDossier(), { fields: undefined }))
        .stage
    ).toBe(READINESS_STAGES.BLOCKED);
    expect(
      getDossierReadinessStage(
        dossierWith(CASE_TYPES.IMMOBILIENKAUF, { verkaeufer: null, kaufpreis: null })
      ).stage
    ).toBe(READINESS_STAGES.BLOCKED);
  });
});

describe('getDossierFieldMetrics', () => {
  it('zählt belegte und offene Felder und ignoriert leere Einträge', () => {
    expect(
      getDossierFieldMetrics(
        dossierWith(CASE_TYPES.IMMOBILIENKAUF, {
          a: VERIFIED,
          b: MISSING,
          c: NEEDS_REVIEW,
          d: null,
        })
      )
    ).toEqual({ total: 3, verifiedCount: 1, pendingCount: 2, isAllVerified: false });
  });

  it('meldet vollständig belegt nur bei mindestens einem Feld und ohne offene', () => {
    expect(
      getDossierFieldMetrics(dossierWith(CASE_TYPES.IMMOBILIENKAUF, { a: VERIFIED, b: VERIFIED }))
    ).toEqual({
      total: 2,
      verifiedCount: 2,
      pendingCount: 0,
      isAllVerified: true,
    });
    expect(getDossierFieldMetrics(dossierWith(CASE_TYPES.IMMOBILIENKAUF, {}))).toEqual({
      total: 0,
      verifiedCount: 0,
      pendingCount: 0,
      isAllVerified: false,
    });
  });
});
