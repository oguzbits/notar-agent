import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_FINISH_REASONS } from '@/types/document';
import { parseDocumentWithGemini } from './gemini-pdf-parser';

describe('gemini-pdf-parser', () => {
  const originalEnv = { ...process.env };
  const mockFetch = vi.fn();

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('wirft einen Fehler, wenn kein GEMINI_API_KEY vorhanden ist', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    await expect(parseDocumentWithGemini(Buffer.from('fake-pdf'), { apiKey: '' })).rejects.toThrow(
      'Kein GEMINI_API_KEY verfügbar'
    );
  });

  it('parst ein PDF erfolgreich und erzeugt strukturierte Blöcke', async () => {
    process.env.GEMINI_API_KEY = 'test-api-key';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '# KAUFVERTRAG\n\n| Partei | Name |\n| :--- | :--- |\n| Verkäufer | Mustermann |\n\n§ 1 Kaufgegenstand\nFlur 1, Flurstück 2.',
                },
              ],
            },
            finishReason: GEMINI_FINISH_REASONS.STOP,
          },
        ],
      }),
    });

    const result = await parseDocumentWithGemini(Buffer.from('%PDF-1.4 test'), {
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.hasTextLayer).toBe(true);
    expect(result.needsOcr).toBe(false);
    expect(result.markdown).toContain('| Partei | Name |');
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('wechselt bei RECITATION zum Fallback-Modell', async () => {
    process.env.GEMINI_API_KEY = 'test-api-key';

    // 1. Aufruf: Primary Model wirft RECITATION
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [] },
            finishReason: GEMINI_FINISH_REASONS.RECITATION,
          },
        ],
      }),
    });

    // 2. Aufruf: Fallback Model liefert Text
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Erfolgreich transkribiert durch Fallback-Modell' }],
            },
            finishReason: GEMINI_FINISH_REASONS.STOP,
          },
        ],
      }),
    });

    const result = await parseDocumentWithGemini(Buffer.from('%PDF-1.4 test'), {
      model: 'gemini-3.1-flash-lite',
      fallbackModel: 'gemini-3.5-flash-lite',
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.markdown).toBe('Erfolgreich transkribiert durch Fallback-Modell');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('wiederholt Anfragen bei HTTP 503 Überlastung', async () => {
    process.env.GEMINI_API_KEY = 'test-api-key';

    // 1. Aufruf: 503 High Demand
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: { message: 'High demand spike' } }),
    });

    // 2. Aufruf: 200 OK
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Nach Retry erfolgreich' }],
            },
            finishReason: GEMINI_FINISH_REASONS.STOP,
          },
        ],
      }),
    });

    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const result = await parseDocumentWithGemini(Buffer.from('%PDF-1.4 test'), {
      sleep: sleepMock,
    });

    expect(result.markdown).toBe('Nach Retry erfolgreich');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
  });
});
