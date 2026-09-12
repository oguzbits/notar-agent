import { Dossier, GenericFieldDossier, getDossierFieldsRecord } from '@/types/dossier';
import { CASE_TYPE_CORE_FIELDS } from './constants';
import type { CaseTypeCoreConfig } from './types';

export type ReadinessStage = 'READY' | 'DRAFTING_POSSIBLE' | 'BLOCKED';

export interface ReadinessInfo {
  stage: ReadinessStage;
  badgeLabel: string;
  description: string;
}

/**
 * Prüft, ob ein Dossier vollständig entwurfsreif ist.
 */
export function isDossierEntwurfsreif(dossier: Dossier): boolean {
  if (!dossier?.fields) return false;

  const fieldValues = Object.values(getDossierFieldsRecord(dossier));
  if (fieldValues.length === 0) return false;

  const allFieldsVerified = fieldValues.every((f) => f && f.status === 'VERIFIED');
  return allFieldsVerified;
}

/**
 * Ermittelt eine praxisnahe notarielle Reifestufe:
 * - READY (Vollständig beurkundungsreif): Alle Pflichtfelder verifiziert
 * - DRAFTING_POSSIBLE (Entwurfserstellung möglich): Die Kerndaten (Parteien, Objekt, Gegenleistung) stehen fest
 * - BLOCKED (Klärung vor Entwurf): Elementare Kernangaben fehlen
 */
export function getDossierReadinessStage(dossier: Dossier): ReadinessInfo {
  if (isDossierEntwurfsreif(dossier)) {
    return {
      stage: 'READY',
      badgeLabel: 'Beurkundungsreif',
      description: 'Alle notariellen Pflichtfelder sind vollständig belegt.',
    };
  }

  // Generische Kerndaten-Prüfung anhand des Vorgangstyps
  const fields = dossier.fields as
    Record<string, GenericFieldDossier<Record<string, unknown>>> | undefined;
  const caseType = dossier.caseType || 'IMMOBILIENKAUF';
  const coreConfig: CaseTypeCoreConfig = CASE_TYPE_CORE_FIELDS[caseType] ??
    CASE_TYPE_CORE_FIELDS.IMMOBILIENKAUF ?? {
      partyFields: ['verkaeufer', 'kaeufer'],
      objectFields: ['kaufpreis', 'grundbuch'],
    };

  const partyOk = coreConfig.partyFields.some((key) => fields?.[key]?.status === 'VERIFIED');
  const objectOk = coreConfig.objectFields.some((key) => fields?.[key]?.status === 'VERIFIED');

  if (partyOk && objectOk) {
    return {
      stage: 'DRAFTING_POSSIBLE',
      badgeLabel: 'Entwurfserstellung möglich',
      description:
        'Wesentliche Vertragsdaten liegen vor. Begleitfragen können parallel geklärt werden.',
    };
  }

  return {
    stage: 'BLOCKED',
    badgeLabel: 'Nachforderung erforderlich',
    description: '',
  };
}
