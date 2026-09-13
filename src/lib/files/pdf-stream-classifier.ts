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
 * Introspektiert PDF-Byte-Puffer deterministisch nach Text-Operatoren und Raster-Images.
 */
export function classifyPdfStream(buffer: Buffer | Uint8Array): PdfStreamClassification {
  const content = buffer.toString('binary');

  // Prüfen auf PDF-Header
  if (!content.includes('%PDF-')) {
    return {
      streamType: PDF_STREAM_TYPES.SCANNED_IMAGE,
      hasTextLayer: false,
      hasRasterImages: false,
      characterCount: 0,
    };
  }

  // 1. Erkennung von Rasterbildern (/Subtype /Image oder Filter /DCTDecode, /JPXDecode, /JBIG2Decode)
  const isImageSubtype = /\/Subtype\s*\/Image/i.test(content);
  const isRasterFilter = /\/Filter\s*(\/DCTDecode|\/JPXDecode|\/JBIG2Decode)/i.test(content);
  const hasRasterImages = isImageSubtype || isRasterFilter;

  // 2. Erkennung von Text-Streams (BT ... ET mit Textanzeige-Operatoren Tj, TJ, ', ")
  const textBlockRegex = /BT[\s\S]*?ET/g;
  const textBlocks = content.match(textBlockRegex) || [];

  let approxCharCount = 0;
  for (const block of textBlocks) {
    // Extrahiere String-Literale in runden Klammern: (Text) Tj oder [(Text)] TJ
    const stringMatches = block.match(/\((.*?)\)/g);
    if (stringMatches) {
      for (const m of stringMatches) {
        approxCharCount += Math.max(0, m.length - 2);
      }
    }
    // Hexadezimal-Strings: <48656c6c6f>
    const hexMatches = block.match(/<([0-9a-fA-F]+)>/g);
    if (hexMatches) {
      for (const h of hexMatches) {
        approxCharCount += Math.floor((h.length - 2) / 2);
      }
    }
  }

  const hasTextLayer = approxCharCount >= MIN_TEXT_CHARS_THRESHOLD;

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
    characterCount: approxCharCount,
  };
}
