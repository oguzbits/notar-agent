import { CASE_TYPES, Dossier, FIELD_STATUS, GenericFieldDossier } from '@/types/dossier';
import { CASE_TYPE_CORE_FIELDS } from './constants';
import { getDossierFieldsRecord } from './state';
import type { CaseTypeCoreConfig } from './types';

export const READINESS_STAGES = {
  READY: 'READY',
  DRAFTING_POSSIBLE: 'DRAFTING_POSSIBLE',
  BLOCKED: 'BLOCKED',
} as const;

export type ReadinessStage = (typeof READINESS_STAGES)[keyof typeof READINESS_STAGES];

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

  const allFieldsVerified = fieldValues.every((f) => f && f.status === FIELD_STATUS.VERIFIED);
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
      stage: READINESS_STAGES.READY,
      badgeLabel: 'Beurkundungsreif',
      description: 'Alle notariellen Pflichtfelder sind vollständig belegt.',
    };
  }

  // Generische Kerndaten-Prüfung anhand des Vorgangstyps
  const fields = dossier.fields as
    Record<string, GenericFieldDossier<Record<string, unknown>>> | undefined;
  const caseType = dossier.caseType || CASE_TYPES.IMMOBILIENKAUF;
  const coreConfig: CaseTypeCoreConfig = CASE_TYPE_CORE_FIELDS[caseType] ??
    CASE_TYPE_CORE_FIELDS[CASE_TYPES.IMMOBILIENKAUF] ?? {
      partyFields: ['verkaeufer', 'kaeufer'],
      objectFields: ['kaufpreis', 'grundbuch'],
    };

  const partyOk = coreConfig.partyFields.some(
    (key) => fields?.[key]?.status === FIELD_STATUS.VERIFIED
  );
  const objectOk = coreConfig.objectFields.some(
    (key) => fields?.[key]?.status === FIELD_STATUS.VERIFIED
  );

  if (partyOk && objectOk) {
    return {
      stage: READINESS_STAGES.DRAFTING_POSSIBLE,
      badgeLabel: 'Entwurfserstellung möglich',
      description:
        'Wesentliche Vertragsdaten liegen vor. Begleitfragen können parallel geklärt werden.',
    };
  }

  return {
    stage: READINESS_STAGES.BLOCKED,
    badgeLabel: 'Nachforderung erforderlich',
    description: '',
  };
}

export interface DossierFieldMetrics {
  total: number;
  verifiedCount: number;
  pendingCount: number;
  isAllVerified: boolean;
}

/**
 * Ermittelt aggregierte Feldstatistiken für die UI, ohne dass Komponenten
 * Filter- oder Zähllogik selbst implementieren müssen.
 */
export function getDossierFieldMetrics(dossier: Dossier): DossierFieldMetrics {
  const fieldsObj = getDossierFieldsRecord(dossier);
  const fieldList = Object.values(fieldsObj).filter(Boolean);
  const total = fieldList.length;
  const verifiedCount = fieldList.filter((f) => f.status === FIELD_STATUS.VERIFIED).length;
  const pendingCount = total - verifiedCount;

  return {
    total,
    verifiedCount,
    pendingCount,
    isAllVerified: total > 0 && verifiedCount === total,
  };
}
