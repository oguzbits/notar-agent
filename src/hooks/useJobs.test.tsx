import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { DOCUMENTS_QUERY_KEY } from '@/hooks/useDocuments';
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
});
