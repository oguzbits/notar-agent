import mammoth from 'mammoth';

export interface DocxExtractedImage {
  id: string;
  contentType: string;
  base64Data: string;
}

export interface DocxParsedContent {
  markdown: string;
  characterCount: number;
  extractedImages: DocxExtractedImage[];
}

interface MammothImage {
  contentType: string;
  readAsBase64String: () => Promise<string>;
}

interface MammothConverterOptions {
  styleMap?: string[];
  convertImage?: unknown;
}

function getMammothConverter(): {
  convertToMarkdown?: (
    input: { buffer: Buffer },
    options?: MammothConverterOptions
  ) => Promise<{ value: string; messages: unknown[] }>;
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
  images?: {
    imgElement: (handler: (image: MammothImage) => Promise<{ src: string }>) => unknown;
  };
} {
  return mammoth as {
    convertToMarkdown?: (
      input: { buffer: Buffer },
      options?: MammothConverterOptions
    ) => Promise<{ value: string; messages: unknown[] }>;
    extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
    images?: {
      imgElement: (handler: (image: MammothImage) => Promise<{ src: string }>) => unknown;
    };
  };
}

/**
 * Standardisierte juristische Formatvorlagen für Notarverträge.
 */
const NOTARY_DOCX_STYLE_MAP = [
  "p[style-name='Klausel'] => h2:fresh",
  "p[style-name='Paragraf'] => h2:fresh",
  "p[style-name='Paragraph'] => h2:fresh",
  "p[style-name='Abschnitt'] => h1:fresh",
  "p[style-name='Rubrum'] => blockquote:fresh",
  "p[style-name='Hinweis'] => aside:fresh",
  "p[style-name='Belehrung'] => aside:fresh",
];

/**
 * Parst ein Word (.docx) Dokument über mammoth direkt in formatiertes Markdown
 * und isoliert eingebettete Siegel, Stempel und Pläne als Bild-Objekte.
 * Vollständig serverless-tauglich ohne LibreOffice-Systemabhängigkeiten.
 */
export async function parseDocxDocument(buffer: Buffer | Uint8Array): Promise<DocxParsedContent> {
  try {
    const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const converter = getMammothConverter();
    const extractedImages: DocxExtractedImage[] = [];

    const options: MammothConverterOptions = {
      styleMap: NOTARY_DOCX_STYLE_MAP,
    };

    if (converter.images?.imgElement) {
      options.convertImage = converter.images.imgElement(async (image) => {
        const imageId = `docx_img_${extractedImages.length + 1}`;
        try {
          const base64Data = await image.readAsBase64String();
          extractedImages.push({
            id: imageId,
            contentType: image.contentType || 'image/png',
            base64Data,
          });
        } catch (imgErr) {
          console.debug('[docx-document-parser] Bildextraktion fehlgeschlagen:', imgErr);
        }
        return { src: `[Grafik/Siegel #${extractedImages.length}: ${imageId}]` };
      });
    }

    const result = converter.convertToMarkdown
      ? await converter.convertToMarkdown({ buffer: nodeBuffer }, options)
      : await converter.extractRawText({ buffer: nodeBuffer });

    const markdown = (result?.value || '').trim();
    return {
      markdown,
      characterCount: markdown.length,
      extractedImages,
    };
  } catch (err: unknown) {
    console.debug('[docx-document-parser] Konvertierung fehlgeschlagen:', err);
    return {
      markdown: '',
      characterCount: 0,
      extractedImages: [],
    };
  }
}
