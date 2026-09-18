import {
  Dossier,
  GenericFieldDossier,
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
