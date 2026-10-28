import { validateEnv } from '@/env';
import { calculateFileFingerprint } from '@/lib/audit/audit-crypto';
import { toCanonicalText } from '@/lib/files/canonical-text';
import { parseDocumentLayoutStructure } from '@/lib/files/layout-structure-parser';
import { logEvent, logFailure } from '@/lib/observability/logger';
import {
  DocumentLayoutBlock,
  DocumentParsedContent,
  DocumentParsedContentSchema,
  GEMINI_FINISH_REASONS,
} from '@/types/document';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const RETRY_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 1500;
const DEFAULT_TIMEOUT_MS = 60000;

export const NOTARY_PDF_TRANSCRIPTION_PROMPT =
  'Transkribiere dieses notarielle Dokument vollständig in Markdown. ' +
  'Behalte die Lesereihenfolge (bei zweispaltigen Seiten linke Spalte zuerst) exakt bei. ' +
  'Rendere Tabellen vollständig als Markdown-Tabellen. ' +
  'Erfasse handschriftliche Ergänzungen, Korrekturen, Siegel und Vermerke wörtlich. ' +
  'Fasse nichts zusammen, übersetze nichts, lasse nichts aus und füge keine Kommentare hinzu. ' +
  'Gib ausschließlich die Transkription aus.';

export const NOTARY_IMAGE_TRANSCRIPTION_PROMPT =
  'Transkribiere den gesamten sichtbaren Text dieses Bildes eines notariellen Dokuments wörtlich in Markdown. ' +
  'Behalte die Lesereihenfolge exakt bei. ' +
  'Rendere Tabellen vollständig als Markdown-Tabellen. ' +
  'Erfasse Handschrift, Korrekturen, Streichungen (als ~~gestrichen~~), Stempel, Siegel und Vermerke wörtlich; ' +
  'markiere unleserliche Stellen mit [unleserlich] und rate nicht. ' +
  'Fasse nichts zusammen, übersetze nichts, lasse nichts aus und füge keine Kommentare hinzu. ' +
  'Gib ausschließlich die Transkription aus.';

export interface GeminiPdfParserOptions {
  /** Medientyp der Datei; ohne Angabe wird er an den Magic Bytes erkannt (Standard: PDF). */
  mediaType?: string;
  apiKey?: string;
  model?: string;
  fallbackModel?: string;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Sendet einen PDF- oder Bild-Buffer direkt an die Google Gemini Vision API.
 */
async function callGeminiGenerateContent(
  apiKey: string,
  model: string,
  base64Data: string,
  mimeType: string,
  prompt: string,
  timeoutMs: number,
  sleepFn: (ms: number) => Promise<void>
): Promise<GeminiCandidate> {
  const url = `${BASE_URL}/models/${model}:generateContent`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (networkErr: unknown) {
      if (attempt < MAX_RETRIES) {
        await sleepFn(DEFAULT_BACKOFF_MS * 2 ** attempt);
        continue;
      }
      throw networkErr;
    }

    if (response.ok) {
      const data = (await response.json()) as GeminiResponse;
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error(`Gemini-Modell "${model}" lieferte keinen Antwort-Kandidaten.`);
      }
      return candidate;
    }

    if (RETRY_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      await sleepFn(DEFAULT_BACKOFF_MS * 2 ** attempt);
      continue;
    }

    let errorDetail = response.statusText;
    try {
      const errJson = (await response.json()) as GeminiResponse;
      if (errJson.error?.message) {
        errorDetail = errJson.error.message;
      }
    } catch (jsonErr: unknown) {
      logFailure('info', 'gemini_fehlerbody_unlesbar', jsonErr);
    }

    throw new Error(`Gemini API HTTP ${response.status} (${model}): ${errorDetail}`);
  }

  throw new Error(`Gemini API (${model}) nach ${MAX_RETRIES} Retries fehlgeschlagen.`);
}

/**
 * Parst ein PDF- oder Bild-Dokument über Google Gemini Vision in semantisch strukturiertes Markdown.
 * Garantiert exakte Tabellen-Extraktion und Entzifferung von Scans/Handschriften.
 */
export async function parseDocumentWithGemini(
  buffer: Buffer | Uint8Array,
  options: GeminiPdfParserOptions = {}
): Promise<DocumentParsedContent> {
  const env = validateEnv(process.env);
  const apiKey =
    options.apiKey ||
    env.GEMINI_API_KEY ||
    env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('Kein GEMINI_API_KEY verfügbar für Gemini PDF-Parsing.');
  }

  const primaryModel = options.model || env.GEMINI_PARSE_MODEL;
  const fallbackModel = options.fallbackModel || env.GEMINI_PARSE_FALLBACK_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sleepFn = options.sleep ?? defaultSleep;

  const rawBytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const base64Data = Buffer.from(rawBytes).toString('base64');

  // Medientyp: explizit übergeben, sonst an den Magic Bytes erkannt (Standard: application/pdf)
  const isPng = rawBytes[0] === 0x89 && rawBytes[1] === 0x50 && rawBytes[2] === 0x4e;
  const isJpeg = rawBytes[0] === 0xff && rawBytes[1] === 0xd8;
  const mimeType =
    options.mediaType ?? (isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'application/pdf');
  const prompt = mimeType.startsWith('image/')
    ? NOTARY_IMAGE_TRANSCRIPTION_PROMPT
    : NOTARY_PDF_TRANSCRIPTION_PROMPT;

  let candidate: GeminiCandidate;
  try {
    candidate = await callGeminiGenerateContent(
      apiKey,
      primaryModel,
      base64Data,
      mimeType,
      prompt,
      timeoutMs,
      sleepFn
    );

    // Bei Recitation-Zitierschutz oder leerer Ausgabe: Fallback-Modell aktivieren
    if (
      (candidate.finishReason === GEMINI_FINISH_REASONS.RECITATION ||
        !candidate.content?.parts?.length) &&
      fallbackModel &&
      fallbackModel !== primaryModel
    ) {
      logEvent({ level: 'warn', event: 'gemini_fallback_finishreason' });
      candidate = await callGeminiGenerateContent(
        apiKey,
        fallbackModel,
        base64Data,
        mimeType,
        prompt,
        timeoutMs,
        sleepFn
      );
    }
  } catch (primaryErr: unknown) {
    if (fallbackModel && fallbackModel !== primaryModel) {
      logFailure('warn', 'gemini_primaermodell_fehlgeschlagen', primaryErr);
      candidate = await callGeminiGenerateContent(
        apiKey,
        fallbackModel,
        base64Data,
        mimeType,
        prompt,
        timeoutMs,
        sleepFn
      );
    } else {
      throw primaryErr;
    }
  }

  const rawMarkdown = (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const canonicalMarkdown = toCanonicalText(rawMarkdown);
  const contentHash = calculateFileFingerprint(buffer);

  // Rekonstruiere logische Layout-Blöcke aus der Markdown-Struktur
  const layout = parseDocumentLayoutStructure(canonicalMarkdown);
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

  const characterCount = canonicalMarkdown.length;
  const hasTextLayer = characterCount > 0;

  const result: DocumentParsedContent = {
    markdown: canonicalMarkdown,
    contentHash,
    totalPages: 1,
    blocks,
    characterCount,
    hasTextLayer,
    needsOcr: false,
    metadata: {
      creator: primaryModel,
    },
  };

  return DocumentParsedContentSchema.parse(result);
}
