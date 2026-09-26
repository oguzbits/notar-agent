import { LiteParse } from '@llamaindex/liteparse';
import { parsePdfDocument } from './pdf-document-parser';

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
 * Introspektiert PDF-Dateien via LiteParse (PDFium Spatial Introspection & Complexity Analysis).
 * Klassifiziert deterministisch zwischen reinem Vektor-/Digital-Text, Scans und hybriden Dokumenten.
 */
export async function classifyPdfStream(
  buffer: Buffer | Uint8Array
): Promise<PdfStreamClassification> {
  // 1. Zuerst binäre Metadaten prüfen
  const textDecoder = new TextDecoder('latin1');
  const binaryStr = textDecoder.decode(buffer);
  const hasImageStreamMarker =
    /\/Subtype\s*\/Image|\/Type\s*\/XObject[^\n\r]*\/Subtype\s*\/Image|\/Filter\s*(\/DCTDecode|\/JPXDecode|\/JBIG2Decode)/i.test(
      binaryStr
    );

  try {
    const rawBuffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const isolatedCopy = new Uint8Array(rawBuffer.byteLength);
    isolatedCopy.set(rawBuffer);

    const parsedDoc = await parsePdfDocument(isolatedCopy);
    const characterCount = parsedDoc.characterCount;
    const hasTextLayer = parsedDoc.hasTextLayer && characterCount >= MIN_TEXT_CHARS_THRESHOLD;

    let hasRasterImages = hasImageStreamMarker;

    if (!hasRasterImages) {
      try {
        const parser = new LiteParse({ quiet: true });
        const complexPages = await parser.isComplex(isolatedCopy);
        hasRasterImages = complexPages.some(
          (p) =>
            p.hasSubstantialImages ||
            p.fullPageImage ||
            p.imageBlockCount > 0 ||
            p.reasons.includes('embedded-images') ||
            p.reasons.includes('scanned')
        );
      } catch (complexErr: unknown) {
        // Binärer Marker dient bereits als Primärsignal
        console.debug('[pdf-stream-classifier] LiteParse isComplex Hinweis:', complexErr);
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
      '[pdf-stream-classifier] Klassifikation fehlgeschlagen, Fallback auf SCANNED_IMAGE:',
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
