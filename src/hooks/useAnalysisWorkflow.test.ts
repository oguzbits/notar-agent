import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { IDEMPOTENCY_KEY_HEADER } from '@/types/jobs';
import { useAnalysisWorkflow } from './useAnalysisWorkflow';

describe('useAnalysisWorkflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles successful background job enqueuing via startAsyncAnalysis', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-12345' }),
      })
    );

    const { result } = renderHook(() => useAnalysisWorkflow());

    let enqueuedJobId: string | null = null;
    await act(async () => {
      await result.current.startAsyncAnalysis(
        [{ name: 'doc.pdf', size: 100, type: 'application/pdf', content: 'test' }],
        CASE_TYPES.IMMOBILIENKAUF,
        'Meine Notizen',
        (jobId) => {
          enqueuedJobId = jobId;
        }
      );
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(enqueuedJobId).toBe('job-12345');
  });

  it('sendet je Absenden einen frischen Idempotency-Key (UUID)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAnalysisWorkflow());
    const files = [{ name: 'doc.pdf', size: 100, type: 'application/pdf', content: 'test' }];

    await act(async () => {
      await result.current.startAsyncAnalysis(files, CASE_TYPES.IMMOBILIENKAUF, '', () => {});
      await result.current.startAsyncAnalysis(files, CASE_TYPES.IMMOBILIENKAUF, '', () => {});
    });

    const keys = fetchMock.mock.calls.map(
      ([, init]) => (init as { headers: Record<string, string> }).headers[IDEMPOTENCY_KEY_HEADER]
    );
    expect(keys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('behält den Idempotency-Key bei gleichem Inhalt bis zur Bestätigung, bei anderem Inhalt nicht', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ jobId: 'job-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useAnalysisWorkflow());
    const files = [{ name: 'doc.pdf', size: 100, type: 'application/pdf', content: 'test' }];
    const other = [{ name: 'andere.pdf', size: 100, type: 'application/pdf', content: 'x' }];
    const run = (f: typeof files) =>
      act(async () => {
        await result.current
          .startAsyncAnalysis(f, CASE_TYPES.IMMOBILIENKAUF, '', () => {})
          .catch(() => {});
      });

    await run(files); // scheitert (Zeitüberschreitung)
    await run(files); // Wiederholung, gleicher Inhalt
    await run(other); // anderer Inhalt

    const keys = fetchMock.mock.calls.map(
      ([, init]) => (init as { headers: Record<string, string> }).headers[IDEMPOTENCY_KEY_HEADER]
    );
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('handles server error response during startAsyncAnalysis properly', async () => {
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
        await result.current.startAsyncAnalysis(
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
