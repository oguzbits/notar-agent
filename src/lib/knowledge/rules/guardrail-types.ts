import { FieldStatus, GenericFieldDossier } from '@/types/dossier';

export interface DomainGuardrailsOptions {
  referenceDate?: Date;
}

export interface GuardrailContext {
  fields: Record<string, GenericFieldDossier<Record<string, unknown>> | undefined>;
  referenceDate: Date;
  referenceDateIso: string;
}

export interface GuardrailRule {
  id: string;
  name: string;
  evaluate(ctx: GuardrailContext): void;
}

/**
 * Hilfsfunktion zum sicheren Aktualisieren von Feld-Status und Notizen.
 */
export function flagField(
  field: GenericFieldDossier<Record<string, unknown>>,
  newStatus: FieldStatus,
  noteText: string,
  append = false
): void {
  field.status = newStatus;
  if (!field.note) {
    field.note = noteText;
  } else if (append && !field.note.includes(noteText)) {
    field.note = `${field.note} (${noteText})`;
  }
}

export function hasSignificantValue(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'boolean') return val;
  return true;
}
