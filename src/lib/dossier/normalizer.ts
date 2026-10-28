import { applyNotaryDomainGuardrails } from '@/lib/knowledge/domain-guardrails';
import { Dossier, DOCUMENT_RELIABILITY, NOTAR_DOCUMENT_TYPES } from '@/types/dossier';
import { getDossierFieldsRecord } from './state';
import { localizeStatusWords } from './status-wording';
import { cleanSourceFileName, parseSourceLocations } from './ui-mapper';

export interface NormalizeDossierOptions {
  referenceDate?: Date;
  additionalNoteTexts?: string[];
}

/**
 * Normalisiert ein Dossier vollumfänglich:
 * - Bereinigt überlange Quellennamen (z.B. "Ergänzende Sachverhalts- und Bearbeitungshinweise") zu "Notiz #1"
 * - Stellt sicher, dass zitierte Notizen auch in "detectedDocuments" (Vorgelegte Unterlagen) auftauchen
 * - Verhindert doppelte oder gesplittete Notizeinträge
 * - Verifiziert juristische Konsistenz-Guardrails (§ 35 GBO, § 12 HGB)
 * - Unterstützt deterministische Stichtagsberechnungen via referenceDate
 */
export function normalizeDossier(
  dossier: Dossier,
  optionsOrNotes?: string[] | NormalizeDossierOptions
): Dossier {
  if (!dossier) return dossier;

  const options: NormalizeDossierOptions = Array.isArray(optionsOrNotes)
    ? { additionalNoteTexts: optionsOrNotes }
    : optionsOrNotes || {};

  const { referenceDate = new Date(), additionalNoteTexts } = options;

  const cloned: Dossier = structuredClone(dossier);

  // 1. Felder bereinigen (source.fileName normalisieren)
  const referencedNotes = new Map<string, string>(); // noteId -> sample snippet

  if (cloned.fields && typeof cloned.fields === 'object') {
    const fieldsObj = getDossierFieldsRecord(cloned);
    for (const field of Object.values(fieldsObj)) {
      // Modelltexte zeigen nie technische Statusnamen (Domain-Sprache); Notiztexte der Sachbearbeitung bleiben unberührt.
      if (field?.note) field.note = localizeStatusWords(field.note);
      if (field?.actionRequired) field.actionRequired = localizeStatusWords(field.actionRequired);
      if (field && field.source && field.source.fileName) {
        const originalName = field.source.fileName;
        const cleaned = cleanSourceFileName(originalName);
        if (cleaned !== originalName) {
          field.source.fileName = cleaned;
        }

        // Falls eine Notiz referenziert wird, merken
        const subSources = parseSourceLocations(field.source);
        for (const sub of subSources) {
          if (sub.fileName.toLowerCase().startsWith('notiz')) {
            if (!referencedNotes.has(sub.fileName) && (sub.snippet || field.source.snippet)) {
              referencedNotes.set(sub.fileName, sub.snippet || field.source.snippet || '');
            }
          }
        }
      }
    }

    // 1b. Fachlich-juristische Konsistenz- & Plausibilitäts-Guardrails anwenden
    applyNotaryDomainGuardrails(fieldsObj, { referenceDate });
  }

  if (typeof cloned.executiveSummary === 'string') {
    cloned.executiveSummary = localizeStatusWords(cloned.executiveSummary);
  }
  for (const inquiry of Array.isArray(cloned.inquiries) ? cloned.inquiries : []) {
    inquiry.subject = localizeStatusWords(inquiry.subject);
    inquiry.message = localizeStatusWords(inquiry.message);
    inquiry.justification = localizeStatusWords(inquiry.justification);
  }

  // 2. detectedDocuments bereinigen
  if (!Array.isArray(cloned.detectedDocuments)) {
    cloned.detectedDocuments = [];
  }

  // Dateinamen in detectedDocuments trimmen
  for (const doc of cloned.detectedDocuments) {
    if (doc && doc.fileName) {
      doc.fileName = doc.fileName.trim();
    }
  }

  // 3. userNotes zusammenführen und pflegen
  const existingNotes: string[] = Array.isArray(cloned.userNotes) ? [...cloned.userNotes] : [];

  if (Array.isArray(additionalNoteTexts)) {
    for (const text of additionalNoteTexts) {
      const trimmed = text.trim();
      if (trimmed && !existingNotes.includes(trimmed)) {
        existingNotes.push(trimmed);
      }
    }
  }

  // Falls userNotes noch leer ist, aus referenzierten Notizen oder bestehenden Vermerken extrahieren
  if (existingNotes.length === 0) {
    for (const snippet of referencedNotes.values()) {
      if (snippet && snippet.trim().length > 0 && !existingNotes.includes(snippet.trim())) {
        existingNotes.push(snippet.trim());
      }
    }
  }

  cloned.userNotes = existingNotes;

  const todayIso =
    (cloned.analysisTimestamp ? cloned.analysisTimestamp.split('T')[0] : undefined) ||
    referenceDate.toISOString().split('T')[0] ||
    new Date().toISOString().slice(0, 10);

  // 4. In detectedDocuments sicherstellen, dass jede Notiz mit ihrem 1:1 Originaltext vorliegt
  // Bestehende Nicht-Notiz Dokumente filtern
  const nonNoteDocs = cloned.detectedDocuments.filter(
    (d) =>
      !d.fileName.toLowerCase().startsWith('notiz') &&
      !d.documentType.toLowerCase().includes('notiz') &&
      !d.documentType.toLowerCase().includes('bearbeitungshinweis')
  );

  const noteDocs: typeof cloned.detectedDocuments = [];

  existingNotes.forEach((noteText, idx) => {
    const noteName = `Notiz #${idx + 1}`;
    noteDocs.push({
      fileName: noteName,
      documentType: NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ,
      date: todayIso,
      pageCount: 1,
      reliability: DOCUMENT_RELIABILITY.LOW,
      summary: noteText, // 1:1 unverkürzter Originaltext, NIEMALS zusammengefasst
    });
  });

  // Notizen ganz oben anstellen, damit der Nutzer sie sofort sieht
  cloned.detectedDocuments = [...noteDocs, ...nonNoteDocs];

  return cloned;
}
