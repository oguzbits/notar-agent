export interface SourceDocumentText {
  fileName: string;
  textContent: string;
}

export interface ResolvedSourceDocument {
  docIndex: number;
  fileName: string;
  textContent: string;
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
    const doc = sourceDocuments[source.docIndex - 1];
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
    if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum <= sourceDocuments.length) {
      const doc = sourceDocuments[parsedNum - 1];
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
  if (foundIdx !== -1) {
    const doc = sourceDocuments[foundIdx];
    if (doc) {
      return {
        docIndex: foundIdx + 1,
        fileName: doc.fileName,
        textContent: doc.textContent,
      };
    }
  }

  return undefined;
}
