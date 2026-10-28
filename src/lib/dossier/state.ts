import { STATUS_OVERRIDE_TEXTS_DE } from '@/lib/dossier/constants';
import { AuditOverrideDetails } from '@/types/audit';
import {
  Dossier,
  GenericFieldDossier,
  FieldReview,
  FieldStatus,
  FIELD_STATUS,
  OVERALL_STATUS,
} from '@/types/dossier';

/**
 * Gibt das typisierte fields-Dictionary des Dossiers zurück.
 */
export function getDossierFieldsRecord(
  dossier: Dossier
): Record<string, GenericFieldDossier<Record<string, unknown>>> {
  return dossier.fields as Record<string, GenericFieldDossier<Record<string, unknown>>>;
}

/**
 * Erzeugt eine unveränderliche Kopie des Dossiers mit aktualisiertem Feld-Status
 * und neu berechnetem overallStatus (100% typsicher ohne Type-Assertions).
 */
export function updateDossierFieldStatus(
  dossier: Dossier,
  fieldKey: string,
  newStatus: FieldStatus,
  customNote?: string
): Dossier {
  const cloned: Dossier = structuredClone(dossier);
  const fields = getDossierFieldsRecord(cloned);

  if (fields[fieldKey]) {
    fields[fieldKey].status = newStatus;
    if (customNote !== undefined) {
      fields[fieldKey].note = customNote;
    }
  }

  const allVerified = Object.values(fields).every((f) => f && f.status === FIELD_STATUS.VERIFIED);
  cloned.overallStatus = allVerified ? OVERALL_STATUS.READY : cloned.overallStatus;

  return cloned;
}

interface FieldStatusChange {
  fieldKey: string;
  previousStatus?: FieldStatus;
  newStatus?: FieldStatus;
}

/** Alle Felder, deren Status sich unterscheidet; hinzugefügte und entfernte Felder zählen mit. */
function changedFieldStatuses(previous: Dossier, next: Dossier): FieldStatusChange[] {
  const before = getDossierFieldsRecord(previous);
  const after = getDossierFieldsRecord(next);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .map((fieldKey) => ({
      fieldKey,
      previousStatus: before[fieldKey]?.status,
      newStatus: after[fieldKey]?.status,
    }))
    .filter((c) => c.previousStatus !== c.newStatus);
}

/** JSON-Gleichheit unabhängig von der Schlüsselreihenfolge (Schema-Parsing und Datenbank sortieren unterschiedlich). */
function isSameJson(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([x], [y]) => x.localeCompare(y))
              .map(([k, v]) => [k, canonical(v)])
          )
        : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** Daten oder Fundstelle eines vorhandenen Feldes weichen vom gespeicherten Stand ab. */
function hasChangedFieldEvidence(previous: Dossier, next: Dossier): boolean {
  const before = getDossierFieldsRecord(previous);
  return Object.entries(getDossierFieldsRecord(next)).some(([key, field]) => {
    const old = before[key];
    return (
      old !== undefined &&
      (!isSameJson(old.data, field.data) || !isSameJson(old.source, field.source))
    );
  });
}

export interface StatusOverrideCheck {
  /** Statuswechsel oder Begründung liegt vor: verlangt das Recht OVERRIDE_FIELD_STATUS. */
  requiresOverride: boolean;
  error?: string;
  /** Die zu auditierende Begründung; der bisherige Status stammt aus dem gespeicherten Stand. */
  override?: AuditOverrideDetails;
}

/**
 * Bindet die Begründung an den echten Wechsel: Erlaubt ist genau ein geändertes Feld, und zwar das
 * begründete, auf den angegebenen Status. Ohne gespeicherten Stand gibt es keinen Wechsel.
 * Daten und Fundstellen sind Ergebnis der Analyse: nur Status und Notiz sind bearbeitbar.
 */
export function checkStatusOverride(
  stored: Dossier | undefined,
  next: Dossier,
  claimed: AuditOverrideDetails | undefined
): StatusOverrideCheck {
  const check = checkStatusChange(stored, next, claimed);
  const error = stored && lockedChangeError(stored, next);
  return error ? { requiresOverride: check.requiresOverride, error } : check;
}

/** Vom Client nicht änderbar: Daten, Fundstellen und die Freigabe („bereit“) bei offenen Feldern. */
function lockedChangeError(stored: Dossier, next: Dossier): string | undefined {
  if (hasChangedFieldEvidence(stored, next)) return STATUS_OVERRIDE_TEXTS_DE.EVIDENCE_LOCKED;
  const newlyReady =
    next.overallStatus === OVERALL_STATUS.READY && stored.overallStatus !== OVERALL_STATUS.READY;
  const allVerified = Object.values(getDossierFieldsRecord(next)).every(
    (f) => f.status === FIELD_STATUS.VERIFIED
  );
  return newlyReady && !allVerified ? STATUS_OVERRIDE_TEXTS_DE.READY_REQUIRES_VERIFIED : undefined;
}

function checkStatusChange(
  stored: Dossier | undefined,
  next: Dossier,
  claimed: AuditOverrideDetails | undefined
): StatusOverrideCheck {
  const changes = stored ? changedFieldStatuses(stored, next) : [];
  if (!claimed) {
    return changes.length === 0
      ? { requiresOverride: false }
      : { requiresOverride: true, error: STATUS_OVERRIDE_TEXTS_DE.REASON_REQUIRED };
  }
  const [change] = changes;
  if (
    changes.length !== 1 ||
    change?.fieldKey !== claimed.fieldKey ||
    change.newStatus !== claimed.newStatus ||
    !change.previousStatus
  ) {
    return { requiresOverride: true, error: STATUS_OVERRIDE_TEXTS_DE.MISMATCH };
  }
  return {
    requiresOverride: true,
    override: { ...claimed, previousStatus: change.previousStatus },
  };
}

/**
 * Setzt den Prüfvermerk an einem Feld. Nur belegte Felder (VERIFIED) lassen sich bestätigen;
 * alle anderen Felder werden über die Statusänderung mit Begründung entschieden.
 */
export function confirmField(dossier: Dossier, fieldKey: string, review: FieldReview): Dossier {
  const cloned: Dossier = structuredClone(dossier);
  const field = getDossierFieldsRecord(cloned)[fieldKey];
  if (!field) throw new Error(`Feld '${fieldKey}' existiert nicht.`);
  if (field.status !== FIELD_STATUS.VERIFIED) {
    throw new Error(`Feld '${fieldKey}' ist nicht belegt und kann nicht bestätigt werden.`);
  }
  field.review = review;
  return cloned;
}

/**
 * Ein Prüfvermerk gilt nur für den Stand, den der Notar gesehen hat: Er stammt immer aus dem
 * gespeicherten Dossier (nie vom Client oder Modell) und entfällt bei geänderten Daten, Quelle oder Status.
 */
export function carryOverReviews(previous: Dossier | undefined, next: Dossier): Dossier {
  const cloned: Dossier = structuredClone(next);
  const before = previous ? getDossierFieldsRecord(previous) : {};
  for (const [key, field] of Object.entries(getDossierFieldsRecord(cloned))) {
    const old = before[key];
    const unchanged =
      old?.review &&
      old.status === field.status &&
      isSameJson(old.data, field.data) &&
      isSameJson(old.source, field.source);
    if (unchanged) field.review = old.review;
    else delete field.review;
  }
  return cloned;
}
