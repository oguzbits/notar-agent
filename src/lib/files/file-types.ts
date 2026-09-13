import { fileTypeFromBuffer } from 'file-type';

/**
 * Deklarative Typdefinitionen und Validierungsstrategien für Dateiuploads im Notariat.
 * Single Source of Truth für MIME-Typen, Endungen und Magic-Byte Signaturen (file-type).
 */

export const FILE_CATEGORIES = {
  IMAGE: 'IMAGE',
  PDF: 'PDF',
  TEXT: 'TEXT',
  BINARY: 'BINARY',
} as const;

export type FileCategory = (typeof FILE_CATEGORIES)[keyof typeof FILE_CATEGORIES];

export interface FileTypeDefinition {
  category: FileCategory;
  mimePattern: RegExp;
  extensions: readonly string[];
  canonicalMime: string;
}

export const SUPPORTED_FILE_TYPES: readonly FileTypeDefinition[] = [
  {
    category: FILE_CATEGORIES.PDF,
    mimePattern: /^application\/pdf$/i,
    extensions: ['.pdf'],
    canonicalMime: 'application/pdf',
  },
  {
    category: FILE_CATEGORIES.IMAGE,
    mimePattern: /^image\/(jpeg|png|webp|bmp|tiff|gif|avif|heic)$/i,
    extensions: [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.bmp',
      '.tiff',
      '.tif',
      '.gif',
      '.avif',
      '.heic',
    ],
    canonicalMime: 'image/jpeg',
  },
  {
    category: FILE_CATEGORIES.TEXT,
    mimePattern: /^(text\/.*|application\/(json|xml|csv))$/i,
    extensions: ['.txt', '.eml', '.msg', '.csv', '.json', '.xml', '.rtf'],
    canonicalMime: 'text/plain',
  },
] as const;

/**
 * Erzeugt einen HTML5 file input accept-String aus den deklarierten Dateitypen.
 * Beispiel: ".pdf,.jpg,.jpeg,.png,.webp,.txt,.eml,.msg,application/pdf,image/*,text/*"
 */
export function getSupportedUploadAcceptString(): string {
  const exts = SUPPORTED_FILE_TYPES.flatMap((t) => t.extensions);
  return `${exts.join(',')},application/pdf,image/*,text/*`;
}

/**
 * Ermittelt die Dateiendung in Kleinbuchstaben inklusive führendem Punkt (z.B. ".pdf").
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Snifft den echten MIME-Type anhand des Puffers via Industrie-Standard `file-type`.
 */
export async function detectMimeFromBuffer(bytes: Uint8Array): Promise<string | undefined> {
  if (!bytes || bytes.length === 0) return undefined;
  try {
    // Isomorphe Cross-Realm Normalisierung: In jsdom/WebWorker-Umgebungen stammt ArrayBuffer aus einem fremden Window-Context.
    // Ein neues Uint8Array im Host-Realm garantiert, dass der `instanceof Uint8Array`-Check in file-type immer wahr ist.
    const hostBuffer = new (globalThis.Uint8Array ?? Uint8Array)(bytes.length);
    hostBuffer.set(bytes);

    const result = await fileTypeFromBuffer(hostBuffer);
    return result?.mime;
  } catch (err: unknown) {
    console.warn('[file-types] Fehler bei file-type Erkennung:', err);
    return undefined;
  }
}

/**
 * Löst die Dateikategorie (PDF, IMAGE, TEXT, BINARY) robust auf.
 * Kombiniert file-type Sniffing, Browser-MIME und Dateiendung.
 */
export async function resolveFileCategory(
  file: { name: string; type?: string },
  headerBytes?: Uint8Array
): Promise<FileCategory> {
  // 1. Industrie-Standard Magic-Byte-Erkennung via `file-type`
  if (headerBytes && headerBytes.length > 0) {
    const detectedMime = await detectMimeFromBuffer(headerBytes);
    if (detectedMime) {
      if (detectedMime === 'application/pdf') {
        return FILE_CATEGORIES.PDF;
      }
      if (detectedMime.startsWith('image/')) {
        return FILE_CATEGORIES.IMAGE;
      }
    }
  }

  const mime = (file.type || '').trim().toLowerCase();
  const ext = getFileExtension(file.name);

  // 2. Deklarative Registry abgleichen (MIME und Extension)
  for (const def of SUPPORTED_FILE_TYPES) {
    if (mime && def.mimePattern.test(mime)) {
      return def.category;
    }
    if (ext && def.extensions.includes(ext)) {
      return def.category;
    }
  }

  return FILE_CATEGORIES.BINARY;
}
