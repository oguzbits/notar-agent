import { extractText, getDocumentProxy } from 'unpdf';

/**
 * Extrahiert reinen Unicode-Text inklusive Formularfeld-Annotationen aus PDF-Daten via unpdf (Mozilla PDF.js Engine).
 * Mathematisch exakt für digitale PDFs, schließt visuelle OCR-Zahlenverwechsler aus.
 */
export async function extractPdfUnicodeText(buffer: Buffer | Uint8Array): Promise<string> {
  try {
    // Verwende einen sauberen, isolierten ArrayBuffer-Slice für Worker/structuredClone
    const rawBuffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const isolatedCopy = new Uint8Array(rawBuffer.byteLength);
    isolatedCopy.set(rawBuffer);

    const doc = await getDocumentProxy(isolatedCopy);
    const pagesText: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const annotations = await page.getAnnotations();

      interface LayoutElement {
        text: string;
        x: number;
        y: number;
      }
      const elements: LayoutElement[] = [];

      for (const item of textContent.items) {
        if (item && typeof item === 'object' && 'str' in item && typeof item.str === 'string') {
          const trimmed = item.str.trim();
          if (trimmed.length > 0) {
            const transform =
              'transform' in item && Array.isArray(item.transform)
                ? item.transform
                : [1, 0, 0, 1, 0, 0];
            elements.push({
              text: trimmed,
              x: Math.round(Number(transform[4]) || 0),
              y: Math.round(Number(transform[5]) || 0),
            });
          }
        }
      }

      for (const a of annotations) {
        const text =
          (a.contentsObj && typeof a.contentsObj === 'object' && 'str' in a.contentsObj
            ? String((a.contentsObj as { str?: unknown }).str || '')
            : '') ||
          (Array.isArray(a.textContent) ? a.textContent.join(' ') : '') ||
          (typeof a.fieldValue === 'string' ? a.fieldValue : '') ||
          '';

        const trimmed = String(text).trim();
        if (trimmed.length > 0) {
          const rect = Array.isArray(a.rect) ? a.rect : [0, 0, 0, 0];
          elements.push({
            text: trimmed,
            x: Math.round(Number(rect[0]) || 0),
            y: Math.round(Number(rect[1]) || 0),
          });
        }
      }

      // Sortiere von oben nach unten (y absteigend), innerhalb derselben Zeile (Toleranz 10px) von links nach rechts (x aufsteigend)
      elements.sort((a, b) => (Math.abs(a.y - b.y) > 10 ? b.y - a.y : a.x - b.x));

      const combined = elements.map((e) => e.text).join('\n');
      if (combined.trim().length > 0) {
        pagesText.push(combined);
      }
    }

    if (pagesText.length > 0) {
      return pagesText.join('\n\n').trim();
    }

    // Fallback auf Standard extractText falls getDocumentProxy leer war
    const result = await extractText(isolatedCopy);
    if (Array.isArray(result.text)) {
      return result.text.join('\n').trim();
    }
    return String(result.text || '').trim();
  } catch (err: unknown) {
    // Bei rein bildbasierten Scans, defektem Header oder unleserlichen PDF-Strukturen:
    // Kein nativer Textlayer vorhanden -> Dual-Stream-Ingestion fällt planmäßig auf multimodale Bild-Analyse zurück.
    const msg = err instanceof Error ? err.message : String(err);
    console.debug(
      `[pdf-text-extractor] Kein nativer Textlayer extrahierbar (${msg}). Dual-Stream Ingestion nutzt multimodale Bildanalyse.`
    );
    return '';
  }
}
