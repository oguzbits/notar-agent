import { NOTAR_DOCUMENT_TYPES, NotarDocumentType } from '@/types/dossier';

export const STANDARD_DOSSIER_PAGE_LIMIT = 80;
export const MEGA_ARCHIVE_PAGE_LIMIT = 150;
export const MAX_GLOBAL_TEXT_CHARS = 300_000;
export const DEFAULT_WINDOW_CHUNK_SIZE_CHARS = 60_000;
export const DEFAULT_WINDOW_OVERLAP_CHARS = 4_000;

export interface WindowingOptions {
  chunkSize?: number;
  overlap?: number;
}

export interface DocumentWindow {
  windowIndex: number;
  totalWindows: number;
  content: string;
  label: string;
  charStart: number;
  charEnd: number;
}

export type RoutingCategory = 'CORE_PRESERVED' | 'STANDARD_PRESERVED' | 'ARCHIVE_WINDOWED';

export interface RoutedDocumentResult {
  fileName: string;
  documentType: NotarDocumentType;
  isWindowed: boolean;
  routingCategory: RoutingCategory;
  windows: DocumentWindow[];
}

/**
 * Dispositive Kern-Urkunden, die für die notarielle Vertragsgestaltung und Rechtsprüfung
 * zwingend zu 100% im globalen Kontext verbleiben müssen (kein Informationsverlust).
 */
const CORE_NOTAR_DOCUMENT_TYPES = new Set<string>([
  NOTAR_DOCUMENT_TYPES.KAUFVERTRAGSENTWURF,
  NOTAR_DOCUMENT_TYPES.GRUNDBUCHAUSZUG,
  NOTAR_DOCUMENT_TYPES.HANDELSREGISTER,
  NOTAR_DOCUMENT_TYPES.ENERGIEAUSWEIS,
  NOTAR_DOCUMENT_TYPES.PERSONALAUSWEIS,
  NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ,
]);

export function isCoreNotarDocument(documentType: NotarDocumentType): boolean {
  return CORE_NOTAR_DOCUMENT_TYPES.has(documentType);
}

/**
 * Bewertet, ob für ein Dokument oder einen Aktenbestand selektives Windowing aktiviert werden muss.
 */
export function shouldApplyDocumentWindowing(
  totalPageCount: number,
  totalCharacterCount: number
): boolean {
  return totalPageCount > MEGA_ARCHIVE_PAGE_LIMIT || totalCharacterCount > MAX_GLOBAL_TEXT_CHARS;
}

/**
 * Zerlegt massiven Fließtext in überlappende Fenster, wobei Absatztrennungen bevorzugt werden.
 */
export function createDocumentWindows(
  content: string,
  options?: WindowingOptions
): DocumentWindow[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_WINDOW_CHUNK_SIZE_CHARS;
  const overlap = options?.overlap ?? DEFAULT_WINDOW_OVERLAP_CHARS;

  if (content.length <= chunkSize) {
    return [
      {
        windowIndex: 1,
        totalWindows: 1,
        content,
        label: 'Vollständiges Dokument (1 von 1)',
        charStart: 0,
        charEnd: content.length,
      },
    ];
  }

  const rawWindows: Array<{ content: string; start: number; end: number }> = [];
  let currentStart = 0;

  while (currentStart < content.length) {
    let currentEnd = Math.min(currentStart + chunkSize, content.length);

    // Versuche an einem Absatzumbruch (\n\n) oder Zeilenumbruch (\n) zu trennen, wenn nicht am Dokumentende
    if (currentEnd < content.length) {
      const naturalBreak = content.lastIndexOf('\n\n', currentEnd);
      if (naturalBreak > currentStart + chunkSize * 0.75) {
        currentEnd = naturalBreak + 2;
      } else {
        const lineBreak = content.lastIndexOf('\n', currentEnd);
        if (lineBreak > currentStart + chunkSize * 0.75) {
          currentEnd = lineBreak + 1;
        }
      }
    }

    const windowText = content.slice(currentStart, currentEnd).trim();
    if (windowText.length > 0) {
      rawWindows.push({
        content: windowText,
        start: currentStart,
        end: currentEnd,
      });
    }

    if (currentEnd >= content.length) {
      break;
    }

    // Nächster Startpunkt mit Überlappung
    currentStart = Math.max(currentStart + 1, currentEnd - overlap);
  }

  const totalWindows = rawWindows.length;
  return rawWindows.map((rw, idx) => ({
    windowIndex: idx + 1,
    totalWindows,
    content: rw.content,
    label: `Fenster ${idx + 1} von ${totalWindows}`,
    charStart: rw.start,
    charEnd: rw.end,
  }));
}

/**
 * Triage-gestütztes Routing:
 * - Kern-Urkunden (Grundbuch, Vertragsentwurf, HRB) bleiben 100% erhalten.
 * - Nur Sekundär- und Archivbände über dem Schwellenwert werden segmentiert.
 */
export function routeAndWindowDocument(params: {
  fileName: string;
  documentType: NotarDocumentType;
  content: string;
  pageCount?: number;
  options?: WindowingOptions;
}): RoutedDocumentResult {
  const { fileName, documentType, content, pageCount = 1, options } = params;

  // 1. Kernurkunden verbleiben uneingeschränkt im vollen Kontext
  if (isCoreNotarDocument(documentType)) {
    return {
      fileName,
      documentType,
      isWindowed: false,
      routingCategory: 'CORE_PRESERVED',
      windows: [
        {
          windowIndex: 1,
          totalWindows: 1,
          content,
          label: 'Kernurkunde (vollständig im globalen Kontext)',
          charStart: 0,
          charEnd: content.length,
        },
      ],
    };
  }

  // 2. Prüfen, ob Schwellenwert für Sekundär- / Archivdokument überschritten ist
  const needsWindowing = shouldApplyDocumentWindowing(pageCount, content.length);
  if (!needsWindowing) {
    return {
      fileName,
      documentType,
      isWindowed: false,
      routingCategory: 'STANDARD_PRESERVED',
      windows: [
        {
          windowIndex: 1,
          totalWindows: 1,
          content,
          label: 'Standarddokument (vollständig im globalen Kontext)',
          charStart: 0,
          charEnd: content.length,
        },
      ],
    };
  }

  // 3. Selektives Windowing für Mega-Archivbände
  const windows = createDocumentWindows(content, options);
  return {
    fileName,
    documentType,
    isWindowed: windows.length > 1,
    routingCategory: 'ARCHIVE_WINDOWED',
    windows,
  };
}
