import imageCompression from 'browser-image-compression';
import { UploadedFilePayload } from '@/types/dossier';
import { FILE_CATEGORIES, FileCategory, resolveFileCategory } from './file-types';

export const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024; // 32 MB Hardlimit für Multimodal-APIs

/**
 * Validiert die Dateigröße gegen das 32 MB Hardlimit.
 */
export function validateFiles(files: File[]): { valid: boolean; error?: string } {
  const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
  if (oversized.length > 0) {
    const names = oversized
      .map((f) => `„${f.name}“ (${(f.size / (1024 * 1024)).toFixed(1)} MB)`)
      .join(', ');
    return {
      valid: false,
      error: `Die Datei ${names} überschreitet die maximale Dateigröße von 32 MB. Um verblichene Grundbuchauszüge, handschriftliche Randvermerke und Amtssiegel nicht durch Qualitätsverlust zu gefährden, komprimieren wir Urkunden nicht automatisch. Bitte teilen Sie die Datei in Abschnitte auf oder scannen Sie sie mit ca. 200–300 DPI.`,
    };
  }
  return { valid: true };
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Optimiert Bilder auf maximal 1600px Kantenlänge via browser-image-compression (WebWorker, EXIF-Korrektur).
 * Fällt in Headless/SSR- oder Test-Umgebungen ohne Worker/Canvas sicher auf readFileAsBase64 zurück.
 */
export async function processImageFile(file: File): Promise<{ content: string; size: number }> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const content = await readFileAsBase64(file);
    return { content, size: file.size };
  }

  try {
    const options = {
      maxSizeMB: 10,
      maxWidthOrHeight: 1600,
      useWebWorker: typeof Worker !== 'undefined',
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    };

    const compressedBlob = await imageCompression(file, options);
    const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
    const content = await readFileAsBase64(compressedFile);
    return {
      content,
      size: compressedBlob.size,
    };
  } catch (err: unknown) {
    console.warn(
      '[file-preparer] browser-image-compression fehlgeschlagen, Fallback auf Originaldatei:',
      err
    );
    const content = await readFileAsBase64(file);
    return { content, size: file.size };
  }
}

/**
 * Strategy-Handler für Bilddateien.
 */
async function prepareImageFile(file: File): Promise<UploadedFilePayload> {
  const { content, size } = await processImageFile(file);
  return {
    name: file.name,
    size,
    type: 'image/jpeg',
    content,
    isBase64: true,
  };
}

/**
 * Strategy-Handler für PDF-Dateien.
 */
async function preparePdfFile(file: File): Promise<UploadedFilePayload> {
  const base64 = await readFileAsBase64(file);
  return {
    name: file.name,
    size: file.size,
    type: 'application/pdf',
    content: base64,
    isBase64: true,
  };
}

/**
 * Strategy-Handler für Text- und Maildateien.
 */
async function prepareTextFile(file: File): Promise<UploadedFilePayload> {
  const text = await readFileAsText(file);
  return {
    name: file.name,
    size: file.size,
    type: file.type || 'text/plain',
    content: text,
    isBase64: false,
  };
}

/**
 * Strategy-Handler für Binär- und Fallback-Dateien.
 */
async function prepareBinaryFile(file: File): Promise<UploadedFilePayload> {
  const base64 = await readFileAsBase64(file);
  return {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    content: base64,
    isBase64: true,
  };
}

/**
 * Deklarative Strategy-Map für Dateitypen.
 */
const FILE_PREPARATION_STRATEGIES: Record<
  FileCategory,
  (file: File) => Promise<UploadedFilePayload>
> = {
  [FILE_CATEGORIES.IMAGE]: prepareImageFile,
  [FILE_CATEGORIES.PDF]: preparePdfFile,
  [FILE_CATEGORIES.TEXT]: prepareTextFile,
  [FILE_CATEGORIES.BINARY]: prepareBinaryFile,
};

/**
 * Liest optional die ersten Header-Bytes einer Datei für Magic-Byte-Sniffing ein.
 */
async function readHeaderBytes(file: File, length = 4100): Promise<Uint8Array | undefined> {
  try {
    const slice = file.slice(0, length);
    const arrayBuffer = await slice.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (err: unknown) {
    console.warn(
      `[file-preparer] Header-Bytes für "${file.name}" konnten nicht gelesen werden:`,
      err
    );
    return undefined;
  }
}

/**
 * Wandelt Rohdateien deklarativ in API-Payloads um (Open-Closed-Principle).
 * Verarbeitet Dateien parallel via Promise.all und löst Typen über die zentrale Registry auf.
 */
export async function prepareFiles(files: File[]): Promise<UploadedFilePayload[]> {
  return Promise.all(
    files.map(async (file) => {
      const headerBytes = await readHeaderBytes(file);
      const category = await resolveFileCategory(file, headerBytes);
      const strategy = FILE_PREPARATION_STRATEGIES[category] ?? prepareBinaryFile;
      return strategy(file);
    })
  );
}
