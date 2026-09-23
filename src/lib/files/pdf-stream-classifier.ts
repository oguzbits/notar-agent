import { extractImages } from 'unpdf';

export const PDF_STREAM_TYPES = {
  DIGITAL_BORN_TEXT: 'DIGITAL_BORN_TEXT',
  SCANNED_IMAGE: 'SCANNED_IMAGE',
  HYBRID_COMPOSITE: 'HYBRID_COMPOSITE',
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
 * Introspektiert PDF-Dateien via unpdf (Mozilla PDF.js) nach Textlayern und Rasterbildern.
 */
export async function classifyPdfStream(
  buffer: Buffer | Uint8Array
): Promise<PdfStreamClassification> {
  // 1. Zuerst binäre Metadaten prüfen, bevor unpdf den Puffer ggf. transferiert/detached
  const textDecoder = new TextDecoder('latin1');
  const binaryStr = textDecoder.decode(buffer);
  const hasImageStreamMarker =
    /\/Subtype\s*\/Image|\/Type\s*\/XObject[^\n\r]*\/Subtype\s*\/Image|\/Filter\s*(\/DCTDecode|\/JPXDecode|\/JBIG2Decode)/i.test(
      binaryStr
    );

  try {
    const uint8 = new Uint8Array(buffer.byteLength);
    uint8.set(buffer);

    const { extractPdfUnicodeText } = await import('./pdf-text-extractor');
    const textJoined = await extractPdfUnicodeText(uint8);

    const characterCount = textJoined.length;
    const hasTextLayer = characterCount >= MIN_TEXT_CHARS_THRESHOLD;

    let hasRasterImages = hasImageStreamMarker;
    if (!hasRasterImages) {
      try {
        const pageImages = await extractImages(new Uint8Array(buffer), 1);
        hasRasterImages = pageImages.length > 0;
      } catch (imgErr: unknown) {
        // Optionale Bildextraktion nicht kritisch, da binärer Stream-Marker bereits als Primärsignal dient
        console.warn('[pdf-stream-classifier] extractImages Hinweis:', imgErr);
      }
    }

    let streamType: PdfStreamType = PDF_STREAM_TYPES.SCANNED_IMAGE;
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
    console.warn(
      '[pdf-stream-classifier] unpdf-Klassifikation fehlgeschlagen, Fallback auf SCANNED_IMAGE:',
      err
    );
    return {
      streamType: PDF_STREAM_TYPES.SCANNED_IMAGE,
      hasTextLayer: false,
      hasRasterImages: true,
      characterCount: 0,
    };
  }
}
