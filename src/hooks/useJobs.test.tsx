import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { DOCUMENTS_QUERY_KEY } from '@/hooks/useDocuments';
import { DELETION_UI_TEXTS_DE } from '@/lib/dossier/constants';
import { CASE_TYPES } from '@/types/dossier';
import { DossierJob, JOB_STATUS, JOB_STAGES } from '@/types/jobs';
import { useJobs, useJob, jobDetailQueryKey } from './useJobs';

describe('useJobs Hook with TanStack Query & MSW', () => {
  const sampleJob: DossierJob = {
    id: 'job-123',
    status: JOB_STATUS.PROCESSING,
    stage: JOB_STAGES.EXTRACTION,
    progressDetails: {
      currentStep: 2,
      totalSteps: 4,
      currentActivity: 'Beteiligte extrahieren...',
    },
    payload: {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Testfall',
    },
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let jobsState: DossierJob[] = [sampleJob];

  const server = setupServer(
    http.get('/api/jobs', () => {
      return HttpResponse.json({ jobs: jobsState });
    }),
    http.post('/api/jobs', async ({ request }) => {
      const body = (await request.json()) as { jobId: string };
      jobsState = jobsState.map((j) =>
        j.id === body.jobId ? { ...j, status: JOB_STATUS.PENDING, errorMessage: undefined } : j
      );
      return HttpResponse.json({ success: true, jobId: body.jobId, status: JOB_STATUS.PENDING });
    })
  );

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jobsState = [sampleJob];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it('fetches jobs list and identifies active jobs', async () => {
    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingJobs).toBe(false);
    });

    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.activeJobs).toHaveLength(1);
    expect(result.current.hasActiveJobs).toBe(true);
  });

  it('retries a failed job', async () => {
    jobsState = [
      {
        ...sampleJob,
        status: JOB_STATUS.FAILED,
        errorMessage: 'Network error',
      },
    ];

    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => {
      expect(result.current.jobs[0]?.status).toBe(JOB_STATUS.FAILED);
    });

    await act(async () => {
      await result.current.retryJob('job-123');
    });

    expect(jobsState[0]?.status).toBe(JOB_STATUS.PENDING);
  });

  it('cancels an active job via cancelJob', async () => {
    server.use(
      http.post('/api/jobs/:id/cancel', async ({ params }) => {
        const id = params.id as string;
        jobsState = jobsState.map((j) =>
          j.id === id ? { ...j, status: JOB_STATUS.CANCELLED } : j
        );
        return HttpResponse.json({ success: true, message: 'Vorgang abgebrochen' });
      })
    );

    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => {
      expect(result.current.jobs[0]?.status).toBe(JOB_STATUS.PROCESSING);
    });

    await act(async () => {
      const success = await result.current.cancelJob('job-123');
      expect(success).toBe(true);
    });

    expect(jobsState[0]?.status).toBe(JOB_STATUS.CANCELLED);
  });

  it('deletes a job via deleteJob', async () => {
    server.use(
      http.delete('/api/jobs/:id', async ({ params }) => {
        const id = params.id as string;
        jobsState = jobsState.filter((j) => j.id !== id);
        return HttpResponse.json({ success: true });
      })
    );

    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => {
      expect(result.current.jobs.length).toBe(1);
    });

    await act(async () => {
      const success = await result.current.deleteJob('job-123');
      expect(success).toBe(true);
    });

    expect(jobsState.length).toBe(0);
    await waitFor(() => {
      expect(result.current.jobs.length).toBe(0);
    });
  });

  it('rolls back optimistically deleted job if delete API fails', async () => {
    const jobsState: DossierJob[] = [sampleJob];
    server.use(
      http.get('/api/jobs', () => {
        return HttpResponse.json({ jobs: jobsState });
      }),
      http.delete('/api/jobs/:id', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() => useJobs(), { wrapper });

    await waitFor(() => {
      expect(result.current.jobs.length).toBe(1);
    });

    let success = true;
    await act(async () => {
      success = await result.current.deleteJob('job-123');
    });

    expect(success).toBe(false);
    await waitFor(() => {
      expect(result.current.jobs.length).toBe(1);
    });
    expect(result.current.jobs[0]?.id).toBe('job-123');
  });

  it('meldet Fehler der Wiederholung mit der Servermeldung und löscht sie beim nächsten Versuch', async () => {
    server.use(
      http.post('/api/jobs', () =>
        HttpResponse.json(
          { error: 'Dieser Vorgang kann nicht erneut gestartet werden.' },
          { status: 409 }
        )
      )
    );
    const { result } = renderHook(() => useJobs(), { wrapper });
    await waitFor(() => expect(result.current.isLoadingJobs).toBe(false));

    await act(async () => {
      expect(await result.current.retryJob('job-123')).toBe(false);
    });
    expect(result.current.jobActionError).toBe(
      'Dieser Vorgang kann nicht erneut gestartet werden.'
    );

    act(() => result.current.clearJobActionError());
    expect(result.current.jobActionError).toBeNull();
  });

  it('meldet Fehler des Abbruchs mit der Servermeldung', async () => {
    server.use(
      http.post('/api/jobs/:id/cancel', () =>
        HttpResponse.json(
          { error: 'Der Vorgang kann nicht mehr abgebrochen werden.' },
          { status: 409 }
        )
      )
    );
    const { result } = renderHook(() => useJobs(), { wrapper });
    await waitFor(() => expect(result.current.isLoadingJobs).toBe(false));

    await act(async () => {
      expect(await result.current.cancelJob('job-123')).toBe(false);
    });
    expect(result.current.jobActionError).toBe('Der Vorgang kann nicht mehr abgebrochen werden.');
  });

  it('meldet Fehler des Löschens mit fester deutscher Meldung und löscht sie bei Erfolg', async () => {
    server.use(http.delete('/api/jobs/:id', () => new HttpResponse(null, { status: 500 })));
    const { result } = renderHook(() => useJobs(), { wrapper });
    await waitFor(() => expect(result.current.isLoadingJobs).toBe(false));

    await act(async () => {
      await result.current.deleteJob('job-123');
    });
    expect(result.current.jobActionError).toBe(DELETION_UI_TEXTS_DE.ERROR);

    server.use(http.delete('/api/jobs/:id', () => HttpResponse.json({ success: true })));
    await act(async () => {
      expect(await result.current.deleteJob('job-123')).toBe(true);
    });
    expect(result.current.jobActionError).toBeNull();
  });

  it('beendet das Abfragen von useJob, sobald der Job nicht gefunden wird', async () => {
    server.use(
      http.get('/api/jobs/job-weg', () =>
        HttpResponse.json({ error: 'nicht gefunden' }, { status: 404 })
      )
    );
    const { result } = renderHook(() => useJob('job-weg'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const query = queryClient.getQueryCache().find({ queryKey: jobDetailQueryKey('job-weg') });
    const interval = query?.observers[0]?.options.refetchInterval;
    expect(result.current.job).toBeNull();
    expect(typeof interval === 'function' && query ? interval(query) : 'fehlt').toBe(false);
  });

  it('fetches a single job by id via useJob and polls until completed', async () => {
    const singleJob: DossierJob = {
      ...sampleJob,
      id: 'job-single-1',
      status: JOB_STATUS.COMPLETED,
      resultDossierId: 'dossier-456',
    };

    server.use(
      http.get('/api/jobs/job-single-1', () => {
        return HttpResponse.json(singleJob);
      })
    );

    const { result } = renderHook(() => useJob('job-single-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.job).not.toBeNull();
    });

    expect(result.current.job?.id).toBe('job-single-1');
    expect(result.current.job?.status).toBe(JOB_STATUS.COMPLETED);
    expect(result.current.job?.resultDossierId).toBe('dossier-456');
  });

  it('forwards x-organization-id header in useJob when organizationId is provided', async () => {
    let capturedHeader: string | null = null;
    server.use(
      http.get('/api/jobs/job-org-1', ({ request }) => {
        capturedHeader = request.headers.get('x-organization-id');
        return HttpResponse.json({ ...sampleJob, id: 'job-org-1' });
      })
    );

    const { result } = renderHook(() => useJob('job-org-1', 'org-uuid-999'), { wrapper });

    await waitFor(() => {
      expect(result.current.job).not.toBeNull();
    });

    expect(capturedHeader).toBe('org-uuid-999');
  });

  it('invalidates documents query when single job completes', async () => {
    let jobStatus: string = JOB_STATUS.PROCESSING;
    server.use(
      http.get('/api/jobs/job-dynamic', () => {
        return HttpResponse.json({
          ...sampleJob,
          id: 'job-dynamic',
          status: jobStatus,
          resultDossierId: jobStatus === JOB_STATUS.COMPLETED ? 'dossier-dyn' : undefined,
        });
      })
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { rerender } = renderHook(() => useJob('job-dynamic'), { wrapper });

    // Transition job to COMPLETED
    jobStatus = JOB_STATUS.COMPLETED;
    queryClient.invalidateQueries({ queryKey: jobDetailQueryKey('job-dynamic') });
    rerender();

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DOCUMENTS_QUERY_KEY });
    });
  });

  it('respects enabled option and defers fetching until enabled is true', async () => {
    let fetchCalled = false;
    server.use(
      http.get('/api/jobs', () => {
        fetchCalled = true;
        return HttpResponse.json({ jobs: [] });
      })
    );

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useJobs('org-test-uuid', { enabled }),
      {
        wrapper,
        initialProps: { enabled: false },
      }
    );

    expect(result.current.isLoadingJobs).toBe(false);
    expect(result.current.jobs).toEqual([]);
    expect(fetchCalled).toBe(false);

    rerender({ enabled: true });

    await waitFor(() => {
      expect(fetchCalled).toBe(true);
    });
  });
});
