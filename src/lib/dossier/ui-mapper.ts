import {
  Dossier,
  FieldStatus,
  FIELD_STATUS,
  SourceLocation,
  GenericFieldDossier,
} from '@/types/dossier';
import {
  IMMOBILIEN_FIELD_METADATA,
  CASE_TYPE_METADATA_REGISTRY,
  STATUS_DEFAULT_NOTES,
} from './constants';
import { getDossierFieldsRecord } from './state';
import { SubSourceItem, FieldObservation } from './types';

/**
 * Bereinigt Quellennamen (z.B. führende/nachfolgende Whitespaces).
 */
export function cleanSourceFileName(fileName: string): string {
  if (!fileName) return '';
  return fileName.trim();
}

/**
 * Zerlegt kombinierte Quellangaben (z.B. "grundbuch.pdf + makler.pdf" oder "Doc A; Doc B")
 * in strukturierte Einzeleinträge für saubere Badges und verhindert fehlerhaftes Aufspalten.
 */
export function parseSourceLocations(source?: SourceLocation): SubSourceItem[] {
  if (!source || !source.fileName || source.fileName.trim().length === 0) {
    return [];
  }

  // Zuerst bekannte Langbezeichnungen normalisieren
  const cleanedFileName = cleanSourceFileName(source.fileName);
  if (!cleanedFileName) {
    return [];
  }

  // Prüfen, ob echte Kombinationszeichen vorhanden sind
  const isCombined =
    cleanedFileName.includes('+') ||
    cleanedFileName.includes(';') ||
    /\s+und\s+/i.test(cleanedFileName) ||
    cleanedFileName.includes(',');

  if (!isCombined) {
    return [
      {
        fileName: cleanedFileName,
        snippet: source.snippet || undefined,
        pageNumber: source.pageNumber && source.pageNumber > 0 ? source.pageNumber : undefined,
      },
    ];
  }

  // Teile aufspalten und bereinigen
  const rawParts = cleanedFileName
    .split(/\s*\+\s*|\s*;\s*|\s+und\s+|\s*,\s*/i)
    .map(cleanSourceFileName)
    .filter((p) => p.length > 0);

  // Duplikate entfernen (z.B. falls die gleiche Notiz mehrfach genannt wurde)
  const seen = new Set<string>();
  const fileParts: string[] = [];
  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      fileParts.push(part);
    }
  }

  if (fileParts.length <= 1) {
    return [
      {
        fileName: fileParts[0] || cleanedFileName,
        snippet: source.snippet || undefined,
        pageNumber: source.pageNumber && source.pageNumber > 0 ? source.pageNumber : undefined,
      },
    ];
  }

  const snippet = source.snippet || undefined;

  return fileParts.map((fName) => ({
    fileName: fName,
    snippet,
    pageNumber: source.pageNumber && source.pageNumber > 0 ? source.pageNumber : undefined,
  }));
}

/**
 * Sammelt alle konkreten Feststellungen, Prüfhinweise und Handlungsempfehlungen
 * aus den Pflichtfeldern eines Dossiers inklusive aller aufgelösten Quellen.
 */
function buildFieldObservation(
  key: string,
  field: GenericFieldDossier<Record<string, unknown>>,
  meta: { title: string; index: number }
): FieldObservation {
  const note = (field.note || '').trim();
  const action = (field.actionRequired || '').trim();
  const status: FieldStatus = field.status || FIELD_STATUS.MISSING;
  const resolvedNote = note || STATUS_DEFAULT_NOTES[status] || '';
  const sources = parseSourceLocations(field.source);

  return {
    fieldKey: key,
    fieldTitle: meta.title,
    fieldIndex: meta.index,
    status,
    note: resolvedNote,
    actionRequired: action || undefined,
    source: field.source && field.source.fileName ? field.source : undefined,
    sources,
  };
}

export function extractFieldObservations(dossier: Dossier): FieldObservation[] {
  if (!dossier?.fields) return [];

  const metaMap =
    (dossier.caseType && CASE_TYPE_METADATA_REGISTRY[dossier.caseType]) ||
    IMMOBILIEN_FIELD_METADATA;

  const observations: FieldObservation[] = [];
  const fieldsObj = getDossierFieldsRecord(dossier);

  for (const [key, field] of Object.entries(fieldsObj)) {
    if (!field) continue;

    const note = (field.note || '').trim();
    const action = (field.actionRequired || '').trim();
    const status: FieldStatus = field.status || FIELD_STATUS.MISSING;
    const hasExplicitNote = note.length > 0;
    const hasAction = action.length > 0;
    const isProblematicStatus = status !== FIELD_STATUS.VERIFIED;

    if (hasExplicitNote || hasAction || isProblematicStatus) {
      const meta = metaMap[key] || { title: key, index: 99 };
      observations.push(buildFieldObservation(key, field, meta));
    }
  }

  return observations.sort((a, b) => a.fieldIndex - b.fieldIndex);
}

/**
 * Gibt ALLE Pflichtfelder eines Dossiers in tabellarischer Form zurück
 * (sowohl belegte als auch prüfbedürftige).
 */
export function extractAllFieldRows(dossier: Dossier): FieldObservation[] {
  if (!dossier?.fields) return [];

  const metaMap =
    (dossier.caseType && CASE_TYPE_METADATA_REGISTRY[dossier.caseType]) ||
    IMMOBILIEN_FIELD_METADATA;

  const rows: FieldObservation[] = [];
  const fieldsObj = getDossierFieldsRecord(dossier);

  for (const [key, field] of Object.entries(fieldsObj)) {
    if (!field) continue;
    const meta = metaMap[key] || { title: key, index: 99 };
    rows.push(buildFieldObservation(key, field, meta));
  }

  return rows.sort((a, b) => a.fieldIndex - b.fieldIndex);
}
