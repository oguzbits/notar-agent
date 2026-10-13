'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { DOCUMENTS_QUERY_KEY } from '@/hooks/useDocuments';
import { DossierJob, JOB_STATUS } from '@/types/jobs';

export const JOBS_QUERY_KEY = ['jobs'] as const;

export function getJobsQueryKey(organizationId?: string) {
  return organizationId ? (['jobs', organizationId] as const) : JOBS_QUERY_KEY;
}

async function fetchJobs(organizationId?: string): Promise<DossierJob[]> {
  const url = organizationId
    ? `/api/jobs?organizationId=${encodeURIComponent(organizationId)}`
    : '/api/jobs';
  const res = await fetch(url);
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

async function apiDeleteJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Fehler beim Löschen des Jobs');
  }
}

export interface UseJobsOptions {
  enabled?: boolean;
}

export function useJobs(organizationId?: string, options?: UseJobsOptions) {
  const queryClient = useQueryClient();
  const previousActiveCount = useRef<number>(0);
  const queryKey = getJobsQueryKey(organizationId);

  const {
    data: jobs = [],
    isLoading: isLoadingJobs,
    error: jobsError,
    refetch: loadJobs,
  } = useQuery({
    queryKey,
    queryFn: () => fetchJobs(organizationId),
    enabled: options?.enabled,
    placeholderData: keepPreviousData,

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

  const deleteMutation = useMutation({
    mutationFn: apiDeleteJob,
    onMutate: async (deletedId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previousJobs = queryClient.getQueryData<DossierJob[]>(queryKey);

      queryClient.setQueryData<DossierJob[]>(queryKey, (old = []) =>
        old.filter((j) => j.id !== deletedId)
      );

      return { previousJobs };
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousJobs) {
        queryClient.setQueryData(queryKey, context.previousJobs);
      }
    },
    onSettled: () => {
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

  const deleteJob = async (jobId: string): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(jobId);
      return true;
    } catch (err) {
      console.error('Job-Löschen fehlgeschlagen:', err);
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
    deleteJob,
    isRetrying: retryMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isDeletingJob: deleteMutation.isPending,
  };
}

export const jobDetailQueryKey = (jobId: string, organizationId?: string) =>
  organizationId ? (['jobs', jobId, organizationId] as const) : (['jobs', jobId] as const);

async function fetchJobById(jobId: string, organizationId?: string): Promise<DossierJob | null> {
  const headers: Record<string, string> = {};
  if (organizationId) {
    headers['x-organization-id'] = organizationId;
  }
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { headers });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Job '${jobId}' konnte nicht geladen werden`);
  }
  return (await res.json()) as DossierJob;
}

export function useJob(jobId: string | null | undefined, organizationId?: string) {
  const queryClient = useQueryClient();
  const previousStatus = useRef<string | null>(null);

  const {
    data: job = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: jobId ? jobDetailQueryKey(jobId, organizationId) : ['jobs', 'disabled'],
    queryFn: () => (jobId ? fetchJobById(jobId, organizationId) : Promise.resolve(null)),
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
