import { describe, it, expect } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { FIELD_STATUS } from '@/types/dossier';
import { isDossierEntwurfsreif, getDossierReadinessStage, READINESS_STAGES } from './readiness';

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
