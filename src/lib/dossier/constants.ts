import { DeletionReason } from '@/types/deletion';
import { CaseType, FieldStatus, CASE_TYPES, FIELD_STATUS } from '@/types/dossier';
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
  CaseType,
  Record<string, { title: string; index: number }>
> = {
  [CASE_TYPES.IMMOBILIENKAUF]: IMMOBILIEN_FIELD_METADATA,
  [CASE_TYPES.GMBH_GRUENDUNG]: {},
};

/**
 * Registry für elementare Kernfelder je Vorgangstyp (müssen belegt sein für Entwurfserstellung).
 */
export const CASE_TYPE_CORE_FIELDS: Record<CaseType, CaseTypeCoreConfig> = {
  [CASE_TYPES.IMMOBILIENKAUF]: {
    partyFields: ['verkaeufer', 'kaeufer'],
    objectFields: ['kaufpreis', 'grundbuch'],
  },
  [CASE_TYPES.GMBH_GRUENDUNG]: {
    partyFields: ['firma', 'gesellschafter'],
    objectFields: ['stammkapital', 'geschaeftsfuehrer'],
  },
};

export const STATUS_LABELS_DE: Record<FieldStatus, string> = {
  [FIELD_STATUS.VERIFIED]: 'Belegt',
  [FIELD_STATUS.NEEDS_REVIEW]: 'Prüfung nötig',
  [FIELD_STATUS.OUTDATED]: 'Veraltet',
  [FIELD_STATUS.MISSING]: 'Fehlt',
};

export const STATUS_DEFAULT_NOTES: Record<FieldStatus, string> = {
  [FIELD_STATUS.VERIFIED]: 'Vollständig geprüft & durch Aktenbestand belegt.',
  [FIELD_STATUS.NEEDS_REVIEW]: 'Prüfung bzw. sachliche Klärung erforderlich.',
  [FIELD_STATUS.OUTDATED]: 'Die vorgelegten Unterlagen sind veraltet oder abgelaufen.',
  [FIELD_STATUS.MISSING]: 'Erforderliche Nachweise fehlen bisher im Aktenbestand.',
};

/**
 * Notarielle Standard-Aktivitätsbeschreibungen für Hintergrund-Jobs (Stage Activities).
 * Verhindert Leaking von technischem Entwickler-Jargon in UI und Logs.
 */
export const STAGE_ACTIVITY_LABELS_DE = {
  QUEUED: 'In der Kanzlei-Warteschlange eingereiht...',
  PAGE_SPLITTING: 'Aktenbestand sichten & Layout prüfen...',
  EXTRACTION: 'Stammdaten, Flurstücke und Beteiligte erfassen...',
  AUDITING: 'Notarielle Vorprüfung, Fristen & Plausibilisierung...',
  PERSISTING: 'Prüfbericht erstellen & Vorgang aufbereiten...',
} as const;

export const DELETION_REASON_LABELS_DE: Record<DeletionReason, string> = {
  ENTWURF_VERWORFEN: 'Entwurf verworfen',
  FEHLERHAFT_ANGELEGT: 'Fehlerhaft angelegt',
  AUFBEWAHRUNG_ABGELAUFEN: 'Aufbewahrungsfrist abgelaufen',
  SONSTIGES: 'Sonstiger Grund',
};

/** Akteur für Einträge, die der Hintergrundlauf ohne Sitzung schreibt. */
export const AUDIT_SYSTEM_ACTOR_DE = 'System';

export const PRUEFPLAN_UI_TEXTS_DE = {
  TITLE: 'Prüfplan',
  DESCRIPTION: 'Bitte prüfen Sie vor dem Start, was untersucht wird.',
  DOCUMENTS: 'Unterlagen',
  FIELDS: 'Pflichtangaben',
  FIELDS_EMPTY: 'Für diese Vorgangsart sind keine Pflichtangaben hinterlegt.',
  RULES: 'Geltende Prüfregeln',
  RULES_EMPTY: 'Es sind keine Prüfregeln hinterlegt.',
  RULE_REVIEWED: 'geprüft',
  RULE_UNREVIEWED: 'nicht geprüft',
  WARNING: 'Die Regelgrundlage ist nicht vollständig geprüft. Sie können dennoch starten.',
  LOADING: 'Prüfplan wird geladen…',
  ERROR: 'Der Prüfplan konnte nicht geladen werden.',
  RETRY: 'Erneut laden',
  CANCEL: 'Zurück',
  START: 'Prüfung starten',
} as const;

export const UEBERSICHT_FEHLER_TEXTS_DE = {
  LADEN: 'Die Vorgänge konnten nicht geladen werden. Bitte versuchen Sie es erneut.',
  RETRY: PRUEFPLAN_UI_TEXTS_DE.RETRY,
  DISMISS: 'Meldung schließen',
} as const;

export const EXPORT_UI_TEXTS_DE = {
  AUDIT_FEHLT:
    'Der Prüfbericht wurde nicht erstellt, weil das Prüfprotokoll nicht geladen werden konnte. Bitte versuchen Sie es erneut.',
} as const;

export const STATUS_OVERRIDE_TEXTS_DE = {
  REASON_REQUIRED: 'Ein Statuswechsel am Feld braucht eine Begründung für die Akte.',
  MISMATCH:
    'Die Begründung passt nicht zur Änderung: Pro Speichern darf sich genau das begründete Feld auf den angegebenen Status ändern.',
} as const;

export const DELETION_UI_TEXTS_DE = {
  FORMER_USER: 'Gelöschter Nutzer',
  DIALOG_TITLE: 'Vorgang endgültig löschen',
  DIALOG_DESCRIPTION:
    'Alle Dokumente und Daten dieses Vorgangs werden unwiderruflich entfernt. Die Löschung wird im Prüfprotokoll vermerkt.',
  REASON_LABEL: 'Grund der Löschung',
  CONFIRM: 'Endgültig löschen',
  ERROR: 'Der Vorgang konnte nicht gelöscht werden.',
  RETRY: 'Erneut versuchen',
} as const;
