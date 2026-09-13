import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CASE_TYPES, OVERALL_STATUS } from '@/types/dossier';
import { useAnalysisWorkflow } from './useAnalysisWorkflow';

describe('useAnalysisWorkflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockStream(chunks: string[]) {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  }

  it('handles successful SSE analysis stream and triggers callback', async () => {
    const mockResultDossier = {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      caseTitle: 'Test Vorgang',
      analysisTimestamp: new Date().toISOString(),
      detectedDocuments: [],
      fields: {},
      inquiries: [],
      overallStatus: OVERALL_STATUS.READY,
      executiveSummary: 'Alles vollständig.',
    };

    const stream = createMockStream([
      'data: {"type":"step","step":1,"stepDetail":"Schritt 1"}\n\n',
      'data: {"type":"step","step":2,"stepDetail":"Schritt 2"}\n\n',
      `data: {"type":"result","dossier":${JSON.stringify(mockResultDossier)}}\n\n`,
    ]);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      })
    );

    const { result } = renderHook(() => useAnalysisWorkflow());

    let finalResult: unknown = null;
    await act(async () => {
      await result.current.startAnalysis(
        [{ name: 'doc.pdf', size: 100, type: 'application/pdf', content: 'test' }],
        CASE_TYPES.IMMOBILIENKAUF,
        'Meine Notizen',
        (res) => {
          finalResult = res;
        }
      );
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(finalResult).toBeDefined();
    expect((finalResult as { dossier: typeof mockResultDossier })?.dossier.caseTitle).toBe(
      'Test Vorgang'
    );
  });

  it('handles server error response properly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'KI-Server überlastet' }),
      })
    );

    const { result } = renderHook(() => useAnalysisWorkflow());

    await act(async () => {
      try {
        await result.current.startAnalysis(
          [{ name: 'doc.pdf', size: 100, type: 'application/pdf', content: 'test' }],
          CASE_TYPES.IMMOBILIENKAUF,
          '',
          () => {}
        );
      } catch (_expectedErr) {
        // Expected error in test scenario
      }
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.errorMessage).toBe('KI-Server überlastet');
  });
});
