export interface PreparedFile {
  name: string;
  size: number;
  type: string;
  content?: string;
  isBase64?: boolean;
}

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
 * Optimiert Bilder auf maximal 1600px Kantenlänge bei 85% JPEG-Qualität für verlässliche OCR.
 */
export function processImageFile(file: File): Promise<{ content: string; size: number }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      readFileAsBase64(file).then((content) => resolve({ content, size: file.size }));
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({
              content: dataUrl,
              size: Math.round((dataUrl.length * 3) / 4),
            });
            return;
          }
        }

        // Bild ist bereits <= 1600px
        const result = (e.target?.result as string) || '';
        resolve({ content: result, size: file.size });
      };
      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      readFileAsBase64(file).then((content) => resolve({ content, size: file.size }));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Verarbeitet eine Liste von Dateien zu typisierten `PreparedFile`-Objekten.
 */
export async function prepareFiles(files: File[]): Promise<PreparedFile[]> {
  const prepared: PreparedFile[] = [];

  for (const file of files) {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isText =
      file.type.startsWith('text/') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.eml') ||
      file.name.endsWith('.msg') ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.json');

    if (isImage) {
      const { content, size } = await processImageFile(file);
      prepared.push({
        name: file.name,
        size,
        type: 'image/jpeg',
        content,
        isBase64: true,
      });
    } else if (isPdf) {
      const base64 = await readFileAsBase64(file);
      prepared.push({
        name: file.name,
        size: file.size,
        type: 'application/pdf',
        content: base64,
        isBase64: true,
      });
    } else if (isText) {
      const text = await readFileAsText(file);
      prepared.push({
        name: file.name,
        size: file.size,
        type: file.type || 'text/plain',
        content: text,
        isBase64: false,
      });
    } else {
      const base64 = await readFileAsBase64(file);
      prepared.push({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        content: base64,
        isBase64: true,
      });
    }
  }

  return prepared;
}
