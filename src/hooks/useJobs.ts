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

async function apiCancelJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Fehler beim Abbrechen des Jobs');
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

  const cancelMutation = useMutation({
    mutationFn: apiCancelJob,
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

  const cancelJob = async (jobId: string): Promise<boolean> => {
    try {
      await cancelMutation.mutateAsync(jobId);
      return true;
    } catch (err) {
      console.error('Job-Abbruch fehlgeschlagen:', err);
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
    cancelJob,
    isRetrying: retryMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}

export const jobDetailQueryKey = (jobId: string) => ['jobs', jobId] as const;

async function fetchJobById(jobId: string): Promise<DossierJob | null> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Job '${jobId}' konnte nicht geladen werden`);
  }
  return (await res.json()) as DossierJob;
}

export function useJob(jobId: string | null | undefined) {
  const queryClient = useQueryClient();
  const previousStatus = useRef<string | null>(null);

  const {
    data: job = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: jobId ? jobDetailQueryKey(jobId) : ['jobs', 'disabled'],
    queryFn: () => (jobId ? fetchJobById(jobId) : Promise.resolve(null)),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const currentJob = query.state.data;
      if (!currentJob) return 2000;
      const isActive =
        currentJob.status === JOB_STATUS.PENDING || currentJob.status === JOB_STATUS.PROCESSING;
      return isActive ? 2000 : false;
    },
  });

  // Wenn der Job von aktiv/unbekannt auf COMPLETED wechselt, Dokumenten- und Job-Liste invalidieren
  useEffect(() => {
    if (job?.status === JOB_STATUS.COMPLETED && previousStatus.current !== JOB_STATUS.COMPLETED) {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    }
    previousStatus.current = job?.status ?? null;
  }, [job?.status, queryClient]);

  return {
    job,
    isLoading,
    error,
    refetch,
  };
}
