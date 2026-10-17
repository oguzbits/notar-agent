export interface SourceDocumentText {
  fileName: string;
  textContent: string;
  /** Prompt-Nummer (1-basiert); 0 für Quellen ohne Prompt-Dokument (Notiz). Fehlt sie, zählt die Listenposition. */
  docIndex?: number;
}

export interface ResolvedSourceDocument {
  docIndex: number;
  fileName: string;
  textContent: string;
}

function findByPromptIndex(
  sourceDocuments: SourceDocumentText[],
  promptIndex: number
): SourceDocumentText | undefined {
  return sourceDocuments.find((d, i) => (d.docIndex ?? i + 1) === promptIndex);
}

/**
 * Löst Quellendokumente flexibel über docIndex, Kurzschlüssel ([DOC-1], doc_1) oder Dateinamen auf.
 */
export function resolveSourceDocument(
  source: { fileName?: string; docIndex?: number; citationId?: string } | undefined,
  sourceDocuments: SourceDocumentText[]
): ResolvedSourceDocument | undefined {
  if (!source) return undefined;

  // 1. Prioritärer Lookup über expliziten 1-basierten docIndex
  if (typeof source.docIndex === 'number' && source.docIndex > 0) {
    const doc = findByPromptIndex(sourceDocuments, source.docIndex);
    if (doc) {
      return {
        docIndex: source.docIndex,
        fileName: doc.fileName,
        textContent: doc.textContent,
      };
    }
  }

  // 2. Lookup über Dateiname oder Kurzschlüssel (z. B. "[DOC-1]", "doc_1", "Dokument #1", "1")
  const key = (source.citationId || source.fileName || '').trim();
  if (!key) return undefined;

  // Regex-Check auf Kurzschlüssel wie [DOC-1], DOC-1, doc_1, Dokument #1, [Dokument #1] oder reine Ziffer "1"
  const docNumMatch = key.match(
    /(?:(?:\[\s*)?(?:doc|dokument|c)[\s\-_#]*(\d+)(?:\s*\])?)|^(\d+)$/i
  );
  if (docNumMatch) {
    const rawNum = docNumMatch[1] || docNumMatch[2];
    const parsedNum = rawNum ? parseInt(rawNum, 10) : NaN;
    if (!isNaN(parsedNum) && parsedNum > 0) {
      const doc = findByPromptIndex(sourceDocuments, parsedNum);
      if (doc) {
        return {
          docIndex: parsedNum,
          fileName: doc.fileName,
          textContent: doc.textContent,
        };
      }
    }
  }

  // 3. Fallback: Exakter & case-insensitiver Dateinamen-Abgleich
  const lowerKey = key.toLowerCase();
  const foundIdx = sourceDocuments.findIndex((d) => d.fileName.toLowerCase().trim() === lowerKey);
  const found = sourceDocuments[foundIdx];
  if (found) {
    return {
      docIndex: found.docIndex ?? foundIdx + 1,
      fileName: found.fileName,
      textContent: found.textContent,
    };
  }

  return undefined;
}
