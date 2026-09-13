import { extractText } from 'unpdf';

/**
 * Extrahiert reinen Unicode-Text aus PDF-Daten via unpdf (Mozilla PDF.js Engine).
 * Mathematisch exakt für digitale PDFs, schließt visuelle OCR-Zahlenverwechsler aus.
 */
export async function extractPdfUnicodeText(buffer: Buffer | Uint8Array): Promise<string> {
  try {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const result = await extractText(uint8);
    if (Array.isArray(result.text)) {
      return result.text.join('\n').trim();
    }
    return String(result.text || '').trim();
  } catch (err: unknown) {
    // Bei defektem Header oder unleserlichen PDF-Strukturen loggen und leer zurückgeben
    console.warn('[pdf-text-extractor] Konnte Textlayer via unpdf nicht parsen:', err);
    return '';
  }
}
