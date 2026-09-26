import { LiteParse } from '@llamaindex/liteparse';
import {
  DocumentLayoutBlock,
  DocumentParsedContent,
  DocumentParsedContentSchema,
} from '@/types/document';

/**
 * Optionen für die Dokumenten-Kontext-Extraktion.
 */
export interface ParsePdfDocumentOptions {
  ocrEnabled?: boolean;
  maxPages?: number;
  preserveVerySmallText?: boolean;
}

/**
 * Parst ein PDF-Dokument über LiteParse in strukturiertes Markdown mit Headings und Tabellen.
 * Gewährleistet lokale, DSGVO-konforme In-Memory-Verarbeitung ohne Cloud-Abhängigkeiten.
 */
export async function parsePdfDocument(
  buffer: Buffer | Uint8Array,
  options: ParsePdfDocumentOptions = {}
): Promise<DocumentParsedContent> {
  try {
    const rawBuffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const isolatedCopy = new Uint8Array(rawBuffer.byteLength);
    isolatedCopy.set(rawBuffer);

    // LiteParse initialisieren (im JSON-Modus, um sowohl Layout-Markdown als auch interaktive Formular-/Annotationselemente vollständig zu erfassen)
    const parser = new LiteParse({
      outputFormat: 'json',
      ocrEnabled: options.ocrEnabled ?? false,
      maxPages: options.maxPages ?? 1000,
      preserveVerySmallText: options.preserveVerySmallText ?? true,
      extractAnnotations: true,
      extractFormFields: true,
      quiet: true,
    });

    const parsed = await parser.parse(isolatedCopy);

    const blocks: DocumentLayoutBlock[] = [];
    const pageMarkdownSections: string[] = [];

    for (const page of parsed.pages || []) {
      const pageNum = Number(page.pageNum) || 1;
      const baseMarkdown = String(page.markdown || page.text || '').trim();

      // Annotationen & Formularfeldinhalte extrahieren
      const pageAnnotations: string[] = [];
      if (Array.isArray(page.annotations)) {
        for (const a of page.annotations) {
          const content = String(a.contents || '').trim();
          if (content.length > 0) {
            pageAnnotations.push(content);
            blocks.push({
              pageNumber: pageNum,
              type: 'annotation',
              content,
              bbox: a.rect
                ? {
                    x: Number(a.rect.x) || 0,
                    y: Number(a.rect.y) || 0,
                    width: Number(a.rect.width) || 0,
                    height: Number(a.rect.height) || 0,
                  }
                : undefined,
            });
          }
        }
      }

      if (Array.isArray(page.formFields)) {
        for (const f of page.formFields) {
          const val = String(f.value || '').trim();
          if (val.length > 0) {
            const fieldText = f.name ? `${f.name}: ${val}` : val;
            pageAnnotations.push(fieldText);
            blocks.push({
              pageNumber: pageNum,
              type: 'form_field',
              content: fieldText,
            });
          }
        }
      }

      let sectionText = baseMarkdown;
      if (pageAnnotations.length > 0) {
        const uniqueAnnotations = Array.from(new Set(pageAnnotations));
        const annotationsAppendix =
          `\n\n### Formularangaben & Vermerke (Seite ${pageNum}):\n` +
          uniqueAnnotations.map((item) => `- ${item}`).join('\n');
        sectionText = sectionText ? `${sectionText}\n${annotationsAppendix}` : annotationsAppendix;
      }

      if (sectionText.trim().length > 0) {
        pageMarkdownSections.push(sectionText.trim());
      }
    }

    const markdownText = pageMarkdownSections.join('\n\n---\n\n').trim();
    const characterCount = markdownText.length;
    const hasTextLayer = characterCount > 0;

    const result: DocumentParsedContent = {
      markdown: markdownText,
      totalPages: Number(parsed.totalPages) || (parsed.pages ? parsed.pages.length : 0),
      blocks,
      characterCount,
      hasTextLayer,
      needsOcr: !hasTextLayer,
      metadata: {
        creator: parsed.creator ?? undefined,
        producer: parsed.producer ?? undefined,
        formType: typeof parsed.formType === 'number' ? parsed.formType : undefined,
      },
    };

    return DocumentParsedContentSchema.parse(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.debug(`[pdf-document-parser] Extraktion fehlgeschlagen oder unleserlich: ${msg}`);

    return {
      markdown: '',
      totalPages: 0,
      blocks: [],
      characterCount: 0,
      hasTextLayer: false,
      needsOcr: true,
      metadata: {},
    };
  }
}
