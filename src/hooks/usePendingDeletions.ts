'use client';

import { useQuery } from '@tanstack/react-query';
import { DB_TABLES } from '@/types/database';

const POLL_INTERVAL_MS = 5000;

async function fetchPendingFiles(): Promise<number> {
  const res = await fetch('/api/deletions/pending');
  if (!res.ok) throw new Error('Offene Löschungen konnten nicht geladen werden');
  const data: { pendingFiles: number } = await res.json();
  return data.pendingFiles;
}

/** Fragt solange regelmäßig nach, wie noch Storage-Dateien zu entfernen sind. */
export function usePendingDeletions(organizationId?: string) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [DB_TABLES.DELETION_TASKS, organizationId],
    queryFn: fetchPendingFiles,
    enabled: Boolean(organizationId),
    refetchInterval: (query) => (query.state.data ? POLL_INTERVAL_MS : false),
  });
  return { pendingFiles: data ?? 0, isLoading, isError, retry: refetch };
}
