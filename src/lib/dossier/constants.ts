import { FieldStatus } from '@/types/dossier';
import { CaseTypeCoreConfig } from './types';

export const IMMOBILIEN_FIELD_METADATA: Record<string, { title: string; index: number }> = {
  verkaeufer: { title: 'Verkäufer', index: 1 },
  kaeufer: { title: 'Käufer', index: 2 },
  grundbuch: { title: 'Grundbuch', index: 3 },
  grundstuecke: { title: 'Grundstücke', index: 4 },
  kaufpreis: { title: 'Kaufpreis', index: 5 },
  finanzierung: { title: 'Finanzierung', index: 6 },
  belastungen: { title: 'Belastungen (Abt. II & III)', index: 7 },
  mietverhaeltnisse: { title: 'Mietverhältnisse', index: 8 },
  energieausweis: { title: 'Energieausweis', index: 9 },
  uebergabe: { title: 'Übergabe', index: 10 },
};

/**
 * Registry für Feld-Metadaten je Vorgangstyp.
 * Erlaubt es, später nahtlos neue CaseTypes mit eigenen Pflichtfeldern zu registrieren.
 */
export const CASE_TYPE_METADATA_REGISTRY: Record<
  string,
  Record<string, { title: string; index: number }>
> = {
  IMMOBILIENKAUF: IMMOBILIEN_FIELD_METADATA,
};

/**
 * Registry für elementare Kernfelder je Vorgangstyp (müssen belegt sein für Entwurfserstellung).
 */
export const CASE_TYPE_CORE_FIELDS: Record<string, CaseTypeCoreConfig> = {
  IMMOBILIENKAUF: {
    partyFields: ['verkaeufer', 'kaeufer'],
    objectFields: ['kaufpreis', 'grundbuch'],
  },
};

export const STATUS_LABELS_DE: Record<FieldStatus, string> = {
  VERIFIED: 'Belegt',
  NEEDS_REVIEW: 'Prüfung nötig',
  OUTDATED: 'Veraltet',
  MISSING: 'Fehlt',
};
