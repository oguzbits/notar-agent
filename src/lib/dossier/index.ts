export type { SubSourceItem, FieldObservation, CaseTypeCoreConfig } from './types';
export {
  IMMOBILIEN_FIELD_METADATA,
  CASE_TYPE_METADATA_REGISTRY,
  CASE_TYPE_CORE_FIELDS,
  STATUS_LABELS_DE,
  STATUS_DEFAULT_NOTES,
} from './constants';
export {
  cleanSourceFileName,
  parseSourceLocations,
  extractFieldObservations,
  extractAllFieldRows,
} from './ui-mapper';
export { generatePruefberichtText } from '@/lib/export';
export { getDossierFieldsRecord, updateDossierFieldStatus } from './state';
export { createEmptyImmobilienFields, createEmptyImmobilienDossier } from './defaults';
export {
  READINESS_STAGES,
  isDossierEntwurfsreif,
  getDossierReadinessStage,
  getDossierFieldMetrics,
} from './readiness';
export type { ReadinessStage, ReadinessInfo, DossierFieldMetrics } from './readiness';
export { normalizeDossier } from './normalizer';
export type { NormalizeDossierOptions } from './normalizer';
