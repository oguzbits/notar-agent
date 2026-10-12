import zlib from 'node:zlib';
import { calculateFileFingerprint } from '@/lib/audit/audit-crypto';
import {
  DocumentLayoutBlock,
  DocumentParsedContent,
  DocumentParsedContentSchema,
} from '@/types/document';
import { toCanonicalText } from './canonical-text';
import { parseDocumentWithGemini } from './gemini-pdf-parser';
import { parseDocumentLayoutStructure } from './layout-structure-parser';

/**
 * Optionen für die Dokumenten-Kontext-Extraktion.
 */
export interface ParsePdfDocumentOptions {
  maxPages?: number;
  preserveVerySmallText?: boolean;
  extractScreenshots?: boolean;
  extractImages?: boolean;
}

function decodePdfLiteralString(str: string): string {
  // 1. Unescape octal \ooo (1-3 digits)
  let decoded = str.replace(/\\([0-7]{1,3})/g, (_, oct) => {
    const code = parseInt(oct, 8);
    return Buffer.from([code]).toString('latin1');
  });
  // 2. Unescape common escapes
  decoded = decoded
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\([()\\])/g, '$1');
  return decoded;
}

/**
 * Extrahiert rohen Text direkt aus unkomprimierten oder Deflate-komprimierten PDF-Textströmen.
 * 100% nativ in TypeScript & Node.js ohne native Binaries, WASM oder externe Abhängigkeiten.
 */
function extractTextFromPdfStreams(buffer: Uint8Array): string {
  const textChunks: string[] = [];
  const latin1 = Buffer.from(buffer).toString('latin1');

  // 1. Textoperatoren aus unkomprimierten Streams extrahieren
  const btMatches = latin1.matchAll(/BT[\s\S]*?ET/g);
  for (const match of btMatches) {
    const chunk = match[0];
    const tjMatches = chunk.matchAll(/\((.*?)\)\s*Tj/g);
    for (const tj of tjMatches) {
      if (tj[1]) textChunks.push(decodePdfLiteralString(tj[1]));
    }
  }

  // 2. Flate-komprimierte Streams über Node zlib dekomprimieren
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRegex.exec(latin1)) !== null) {
    const rawMatch = streamMatch[1];
    if (!rawMatch) continue;

    try {
      const rawData = Buffer.from(rawMatch, 'latin1');
      const decompressed = zlib.inflateSync(rawData).toString('latin1');

      const innerBt = decompressed.matchAll(/BT[\s\S]*?ET/g);
      for (const b of innerBt) {
        const tjMatches = b[0].matchAll(/\((.*?)\)\s*Tj/g);
        for (const tj of tjMatches) {
          if (tj[1]) textChunks.push(decodePdfLiteralString(tj[1]));
        }
        const arrayMatches = b[0].matchAll(/\[(.*?)\]\s*TJ/g);
        for (const arr of arrayMatches) {
          if (arr[1]) {
            const parts = arr[1].matchAll(/\((.*?)\)/g);
            for (const p of parts) {
              if (p[1]) textChunks.push(decodePdfLiteralString(p[1]));
            }
          }
        }
      }
    } catch (_err: unknown) {
      // Nicht-komprimierte Streams oder Grafik-Payloads ignorieren
    }
  }

  return textChunks.join('\n').trim();
}

/**
 * Nativer, leichtgewichtiger Fallback-Parser für Offline-Betrieb & CI ohne API-Key.
 */
export async function parsePdfNativeStreamFallback(
  buffer: Buffer | Uint8Array
): Promise<DocumentParsedContent> {
  try {
    const rawBuffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const isolatedCopy = new Uint8Array(rawBuffer.byteLength);
    isolatedCopy.set(rawBuffer);

    // Validiere minimale PDF-Header-Signatur
    const latin1 = Buffer.from(isolatedCopy).toString('latin1');
    if (!latin1.startsWith('%PDF-')) {
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

    const pageMatches = latin1.match(/\/Type\s*\/Page\b/g);
    const rawText = extractTextFromPdfStreams(isolatedCopy);
    const layout = parseDocumentLayoutStructure(rawText);

    const blocks: DocumentLayoutBlock[] = layout.blocks.map((b) => ({
      pageNumber: 1,
      type:
        b.type === 'clause' || b.type === 'department'
          ? 'heading'
          : b.type === 'table'
            ? 'table'
            : 'text',
      content: b.content,
    }));

    const canonicalMarkdown = toCanonicalText(layout.structuredMarkdown);
    const contentHash = calculateFileFingerprint(buffer);
    const characterCount = canonicalMarkdown.length;
    const hasTextLayer = characterCount > 0;
    const totalPages = pageMatches ? pageMatches.length : hasTextLayer ? 1 : 0;

    const result: DocumentParsedContent = {
      markdown: canonicalMarkdown,
      contentHash,
      totalPages,
      blocks,
      characterCount,
      hasTextLayer,
      needsOcr: !hasTextLayer,
      metadata: {
        creator: 'native-stream-parser',
      },
    };

    return DocumentParsedContentSchema.parse(result);
  } catch (err: unknown) {
    console.debug('[pdf-document-parser] Nativer Stream-Fallback fehlgeschlagen:', err);
    return {
      markdown: '',
      contentHash: calculateFileFingerprint(buffer),
      totalPages: 0,
      blocks: [],
      characterCount: 0,
      hasTextLayer: false,
      needsOcr: true,
      metadata: {},
    };
  }
}

/**
 * Universeller PDF-Parser für notarielle Akten und Scans.
 * Nutzt primär Google Gemini Vision (gemini-3.1-flash-lite) für bit- und tabellengenaue Transkription
 * und fällt bei fehlenden Keys oder im Offline-Modus transparent auf den nativen Stream-Parser zurück.
 */
export async function parsePdfDocument(
  buffer: Buffer | Uint8Array,
  _options: ParsePdfDocumentOptions = {}
): Promise<DocumentParsedContent> {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );

  if (hasGeminiKey) {
    try {
      const geminiResult = await parseDocumentWithGemini(buffer);
      if (geminiResult.hasTextLayer && geminiResult.characterCount > 0) {
        return geminiResult;
      }
    } catch (err: unknown) {
      console.warn(
        '[pdf-document-parser] Gemini-Vision Parsing fehlgeschlagen. Aktiviere nativen Stream-Fallback:',
        err
      );
    }
  }

  return parsePdfNativeStreamFallback(buffer);
}
