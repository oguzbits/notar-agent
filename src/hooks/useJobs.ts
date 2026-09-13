'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { DOCUMENTS_QUERY_KEY } from '@/hooks/useDocuments';
import { DossierJob, JOB_STATUS } from '@/types/jobs';

export const JOBS_QUERY_KEY = ['jobs'] as const;

async function fetchJobs(): Promise<DossierJob[]> {
  const res = await fetch('/api/jobs');
  if (!res.ok) {
    throw new Error('Hintergrund-Jobs konnten nicht geladen werden');
  }
  const data = await res.json();
  return (data.jobs || []) as DossierJob[];
}

async function apiRetryJob(jobId: string): Promise<void> {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) {
    throw new Error('Fehler beim Wiederholen des Jobs');
  }
}

export function useJobs() {
  const queryClient = useQueryClient();
  const previousActiveCount = useRef<number>(0);

  const {
    data: jobs = [],
    isLoading: isLoadingJobs,
    error: jobsError,
    refetch: loadJobs,
  } = useQuery({
    queryKey: JOBS_QUERY_KEY,
    queryFn: fetchJobs,
    // Poll every 3 seconds while active jobs exist
    refetchInterval: (query) => {
      const currentJobs = query.state.data ?? [];
      const hasActive = currentJobs.some(
        (j) => j.status === JOB_STATUS.PENDING || j.status === JOB_STATUS.PROCESSING
      );
      return hasActive ? 3000 : false;
    },
  });

  const activeJobs = jobs.filter(
    (j) => j.status === JOB_STATUS.PENDING || j.status === JOB_STATUS.PROCESSING
  );

  // Wenn ein aktiver Job fertiggestellt wurde, die Dokumenten-Tabelle automatisch neu laden
  useEffect(() => {
    if (previousActiveCount.current > activeJobs.length) {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    }
    previousActiveCount.current = activeJobs.length;
  }, [activeJobs.length, queryClient]);

  const retryMutation = useMutation({
    mutationFn: apiRetryJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    },
  });

  const failedJobs = jobs.filter((j) => j.status === JOB_STATUS.FAILED);

  const retryJob = async (jobId: string): Promise<boolean> => {
    try {
      await retryMutation.mutateAsync(jobId);
      return true;
    } catch (err) {
      console.error('Job-Retry fehlgeschlagen:', err);
      return false;
    }
  };

  return {
    jobs,
    activeJobs,
    failedJobs,
    hasActiveJobs: activeJobs.length > 0,
    isLoadingJobs,
    jobsError,
    loadJobs,
    retryJob,
    isRetrying: retryMutation.isPending,
  };
}
