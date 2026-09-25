import { FIELD_STATUS } from '@/types/dossier';
import { ExtractionFieldsRecord, ExtractionStageOutput } from '@/types/pipeline';

export interface SourceDocumentText {
  fileName: string;
  textContent: string;
}

export interface VerificationIssue {
  fieldKey: string;
  expectedSnippet?: string;
  fileName?: string;
  reason: string;
}

export interface VerifyExtractionFactsOptions {
  stageOutput: ExtractionStageOutput;
  sourceDocuments: SourceDocumentText[];
}

export interface VerifyExtractionFactsResult extends ExtractionStageOutput {
  verificationIssues: VerificationIssue[];
}

/**
 * Normalisiert Text für toleranten Snippet-Abgleich (Whitespace & Satzzeichen).
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?"'„“”()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministische Fakten- und Zitationsverifikation (Verifiable Rewards / Fact Checks).
 * Prüft, ob Quellennachweise (Snippets) wörtlich im Originaltext nachweisbar sind.
 * Stuft Felder bei fehlendem Beleg auf NEEDS_REVIEW herab.
 */
export function verifyExtractionFacts(
  options: VerifyExtractionFactsOptions
): VerifyExtractionFactsResult {
  const { stageOutput, sourceDocuments } = options;
  const verificationIssues: VerificationIssue[] = [];

  // Map von normalisiertem Dateinamen auf den Dokumenten-Text
  const sourceMap = new Map<string, string>();
  for (const doc of sourceDocuments) {
    sourceMap.set(doc.fileName.toLowerCase().trim(), doc.textContent);
  }

  const updatedFields: ExtractionFieldsRecord = {};

  for (const [key, field] of Object.entries(stageOutput.fields)) {
    if (!field) continue;

    // Nur verifizierte Felder prüfen, die ein Snippet und einen Dateinamen deklarieren
    if (field.status === FIELD_STATUS.VERIFIED && field.source?.fileName && field.source?.snippet) {
      const targetFileName = field.source.fileName.toLowerCase().trim();
      const rawDocText = sourceMap.get(targetFileName);

      // Falls Textlayer für diese Datei vorhanden ist, wörtliche Existenz prüfen
      if (rawDocText && rawDocText.trim().length > 0) {
        const normalizedDoc = normalizeForComparison(rawDocText);
        const normalizedSnippet = normalizeForComparison(field.source.snippet);

        if (!normalizedDoc.includes(normalizedSnippet)) {
          // Snippet existiert nicht im Original -> Herabstufung
          verificationIssues.push({
            fieldKey: key,
            fileName: field.source.fileName,
            expectedSnippet: field.source.snippet,
            reason: 'Quellen-Snippet nicht wörtlich im Dokument nachweisbar',
          });

          const existingNote = field.note || '';
          const appendNote =
            'Automatische Verifikation: Quellen-Snippet nicht wörtlich im Dokument nachweisbar';
          updatedFields[key] = {
            ...field,
            status: FIELD_STATUS.NEEDS_REVIEW,
            note: existingNote ? `${existingNote} (${appendNote})` : appendNote,
          };
          continue;
        }
      }
    }

    updatedFields[key] = { ...field };
  }

  return {
    ...stageOutput,
    fields: updatedFields,
    verificationIssues,
  };
}
