import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { DossierJob, JOB_STATUS, JOB_STAGES } from '@/types/jobs';
import { useJobs } from './useJobs';

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
});
