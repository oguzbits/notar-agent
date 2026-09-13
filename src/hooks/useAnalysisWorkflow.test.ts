import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
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
