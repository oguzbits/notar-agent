import { parsePdfDocument } from './pdf-document-parser';

export const PDF_STREAM_TYPES = {
  DIGITAL_BORN_TEXT: 'DIGITAL_BORN_TEXT', // Nur nativer Text -> Text-LLM (schnell & billig)
  SCANNED_IMAGE: 'SCANNED_IMAGE', // Reiner Scan / Bild -> Vision-LLM (oder Fehler)
  HYBRID_COMPOSITE: 'HYBRID_COMPOSITE', // Text + Bilder (z. B. Stempel) -> Text-LLM + Bild-Vision
} as const;

export type PdfStreamType = (typeof PDF_STREAM_TYPES)[keyof typeof PDF_STREAM_TYPES];

export interface PdfStreamClassification {
  streamType: PdfStreamType;
  hasTextLayer: boolean;
  hasRasterImages: boolean;
  characterCount: number;
}

const MIN_TEXT_CHARS_THRESHOLD = 30;

/**
 * Schnelle Metadaten-Prüfung ohne Tesseract / OCR.
 * Entscheidet, ob das Dokument als reiner Text oder visuell verarbeitet werden muss.
 */
export async function classifyPdfStream(
  buffer: Buffer | Uint8Array
): Promise<PdfStreamClassification> {
  // 1. Schneller Bild-Check auf den ersten 128 KB (reicht für PDF-Header/Objektreferenzen)
  const previewSlice = buffer.subarray(0, Math.min(buffer.length, 128 * 1024));
  const previewText = new TextDecoder('latin1').decode(previewSlice);
  const hasRasterImages =
    /\/Subtype\s*\/Image|\/Filter\s*(\/DCTDecode|\/JPXDecode|\/JBIG2Decode)/i.test(previewText);

  try {
    const rawBuffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const parsedDoc = await parsePdfDocument(rawBuffer);
    const characterCount = parsedDoc.characterCount;
    const hasTextLayer = parsedDoc.hasTextLayer && characterCount >= MIN_TEXT_CHARS_THRESHOLD;

    let streamType: PdfStreamType;
    if (hasTextLayer && !hasRasterImages) {
      streamType = PDF_STREAM_TYPES.DIGITAL_BORN_TEXT;
    } else if (hasTextLayer && hasRasterImages) {
      streamType = PDF_STREAM_TYPES.HYBRID_COMPOSITE;
    } else {
      streamType = PDF_STREAM_TYPES.SCANNED_IMAGE;
    }

    return {
      streamType,
      hasTextLayer,
      hasRasterImages,
      characterCount,
    };
  } catch (err: unknown) {
    console.warn('[pdf-stream-classifier] Klassifikation fehlgeschlagen:', err);
    return {
      streamType: PDF_STREAM_TYPES.SCANNED_IMAGE,
      hasTextLayer: false,
      hasRasterImages: true,
      characterCount: 0,
    };
  }
}
