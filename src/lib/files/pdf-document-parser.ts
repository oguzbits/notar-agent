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
  maxPages?: number;
  preserveVerySmallText?: boolean;
  extractScreenshots?: boolean;
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

    // LiteParse initialisieren (im JSON-Modus mit voller Struktur- und Annotationsextraktion)
    const parser = new LiteParse({
      outputFormat: 'json',
      ocrEnabled: false,
      ocrLanguage: 'deu',
      maxPages: options.maxPages ?? 1000,
      preserveVerySmallText: options.preserveVerySmallText ?? true,
      extractAnnotations: true,
      extractBlocks: true,
      extractFormFields: true,
      extractScreenshots: options.extractScreenshots ?? false,
      dpi: 144,
      quiet: true,
    });

    const parsed = await parser.parse(isolatedCopy);

    const blocks: DocumentLayoutBlock[] = [];
    const pageMarkdownSections: string[] = [];

    for (const page of parsed.pages || []) {
      const pageNum = Number(page.pageNum) || 1;
      const baseMarkdown = String(page.markdown || page.text || '').trim();

      const pageBlocks = page.blocks || [];
      const correlatedEntries: string[] = [];
      const unmappedEntries: string[] = [];

      // Alle Text- und Layout-Blöcke der Seite erfassen
      for (const b of pageBlocks) {
        if (!b.text || !b.text.trim()) continue;
        blocks.push({
          pageNumber: pageNum,
          type: b.kind === 'heading' ? 'heading' : b.kind === 'table' ? 'table' : 'text',
          content: b.text.trim(),
          bbox: b.bbox
            ? {
                x: Number(b.bbox.x) || 0,
                y: Number(b.bbox.y) || 0,
                width: Number(b.bbox.width) || 0,
                height: Number(b.bbox.height) || 0,
              }
            : undefined,
        });
      }

      // Annotationen räumlich mit Formularfeldern und Labels abgleichen
      if (Array.isArray(page.annotations)) {
        for (const a of page.annotations) {
          const content = String(a.contents || '').trim();
          if (content.length === 0) continue;

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

          const ay = a.rect?.y || 0;
          const ax = a.rect?.x || 0;

          // Rein geometrische Nearest-Neighbor-Korrelation (100% dokument- und domänenagnostisch):
          // 0. Generische Skalen-Interpolation: Wenn die Annotation ein visueller Zeiger/Marker (z.B. ▼, ▲, v, ^) ist
          const isPointerMarker = /^[▼▲v^<>↓↑]$/u.test(content);
          if (isPointerMarker) {
            const scaleBlock = pageBlocks.find(
              (b) =>
                b.text &&
                b.bbox &&
                Math.abs(b.bbox.y - ay) <= 40 &&
                b.bbox.width > 120 &&
                b.text.trim().split(/\s+/).length >= 4
            );
            if (scaleBlock && scaleBlock.bbox && scaleBlock.text) {
              const tokens = scaleBlock.text.trim().split(/\s+/);
              const ratio = (ax - scaleBlock.bbox.x) / scaleBlock.bbox.width;
              const tokenIdx = Math.min(
                Math.max(Math.floor(ratio * tokens.length), 0),
                tokens.length - 1
              );
              const resolvedValue = tokens[tokenIdx];
              // Finde das zugehörige übergeordnete Label direkt über der Skala
              const headerBlock = pageBlocks
                .filter(
                  (b) =>
                    b.text &&
                    b.bbox &&
                    b.bbox.y < scaleBlock.bbox!.y &&
                    scaleBlock.bbox!.y - b.bbox.y <= 50 &&
                    b.text.trim().length > 3
                )
                .sort((b1, b2) => b2.bbox!.y - b1.bbox!.y)[0];
              const headerLabel =
                headerBlock?.text?.split('\n')[0]?.trim().replace(/[*_#]/g, '') || 'Skala';
              correlatedEntries.push(`[${headerLabel} (Markierung ${content})]: ${resolvedValue}`);
              continue;
            }
          }

          // 1. Suche den am nächsten liegenden Textblock auf derselben horizontalen Zeile links (|dy| <= 16, x <= ax + 15)
          const lineBlocks = pageBlocks.filter(
            (b) => b.text && b.bbox && Math.abs(b.bbox.y - ay) <= 16 && b.bbox.x <= ax + 15
          );
          // Sortiere nach dem am weitesten rechts liegenden Rand (nächster linker Nachbar)
          lineBlocks.sort((b1, b2) => b2.bbox!.x + b2.bbox!.width - (b1.bbox!.x + b1.bbox!.width));

          // 2. Vertikaler Fallback: Falls links kein Label existiert, suche nach dem nächsten Textblock direkt darüber (Spaltenüberschrift)
          const aboveBlocks = pageBlocks.filter(
            (b) =>
              b.text &&
              b.bbox &&
              ay - b.bbox.y >= 0 &&
              ay - b.bbox.y <= 32 &&
              Math.abs(b.bbox.x - ax) <= 80
          );
          aboveBlocks.sort((b1, b2) => ay - b1.bbox!.y - (ay - b2.bbox!.y));

          // 3. Fallback: Nächster Block nach euklidischem Abstand in enger Nachbarschaft
          const nearbyBlocks = pageBlocks.filter(
            (b) => b.text && b.bbox && Math.hypot(ax - b.bbox.x, ay - b.bbox.y) <= 45
          );
          nearbyBlocks.sort(
            (b1, b2) =>
              Math.hypot(ax - b1.bbox!.x, ay - b1.bbox!.y) -
              Math.hypot(ax - b2.bbox!.x, ay - b2.bbox!.y)
          );

          const bestBlock = lineBlocks[0] || aboveBlocks[0] || nearbyBlocks[0];

          if (bestBlock?.text) {
            const firstLine = bestBlock.text.split('\n')[0] ?? '';
            const rawLabel = firstLine.trim().replace(/[*_#]/g, '');
            const label = rawLabel.length > 70 ? `${rawLabel.substring(0, 70)}...` : rawLabel;
            correlatedEntries.push(`[${label}]: ${content}`);
          } else {
            unmappedEntries.push(content);
          }
        }
      }

      if (Array.isArray(page.formFields)) {
        for (const f of page.formFields) {
          const val = String(f.value || '').trim();
          if (val.length > 0) {
            const fieldText = f.name ? `[${f.name}]: ${val}` : val;
            correlatedEntries.push(fieldText);
            blocks.push({
              pageNumber: pageNum,
              type: 'form_field',
              content: fieldText,
            });
          }
        }
      }

      let sectionText = baseMarkdown;
      const combinedNotes: string[] = [];

      if (correlatedEntries.length > 0) {
        const uniqueCorrelated = Array.from(new Set(correlatedEntries));
        combinedNotes.push(
          `### Zugeordnete Formularangaben (Seite ${pageNum}):\n` +
            uniqueCorrelated.map((item) => `- ${item}`).join('\n')
        );
      }

      if (unmappedEntries.length > 0) {
        const uniqueUnmapped = Array.from(new Set(unmappedEntries));
        combinedNotes.push(
          `### Weitere Vermerke & Einträge (Seite ${pageNum}):\n` +
            uniqueUnmapped.map((item) => `- ${item}`).join('\n')
        );
      }

      if (combinedNotes.length > 0) {
        const notesBlock = combinedNotes.join('\n\n');
        sectionText = sectionText ? `${sectionText}\n\n${notesBlock}` : notesBlock;
      }

      if (sectionText.trim().length > 0) {
        pageMarkdownSections.push(sectionText.trim());
      }
    }

    const markdownText = pageMarkdownSections.join('\n\n---\n\n').trim();
    const characterCount = markdownText.length;
    const hasTextLayer = characterCount > 0;

    const pageScreenshots = Array.isArray(parsed.screenshots)
      ? parsed.screenshots.map((s) => ({
          pageNum: s.pageNum,
          width: s.width,
          height: s.height,
          base64Png: `data:image/png;base64,${s.imageBuffer.toString('base64')}`,
        }))
      : undefined;

    const result: DocumentParsedContent = {
      markdown: markdownText,
      totalPages: Number(parsed.totalPages) || (parsed.pages ? parsed.pages.length : 0),
      blocks,
      characterCount,
      hasTextLayer,
      needsOcr: !hasTextLayer,
      pageScreenshots,
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
