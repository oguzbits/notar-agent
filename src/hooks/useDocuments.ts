'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DB_TABLES } from '@/types/database';
import { DocumentRecord } from '@/types/document';
import { Dossier } from '@/types/dossier';

export const DOCUMENTS_QUERY_KEY = [DB_TABLES.DOCUMENTS] as const;

export function getDocumentsQueryKey(organizationId?: string) {
  return organizationId ? ([DB_TABLES.DOCUMENTS, organizationId] as const) : DOCUMENTS_QUERY_KEY;
}

async function fetchDocuments(organizationId?: string): Promise<DocumentRecord[]> {
  const url = organizationId
    ? `/api/documents?organizationId=${encodeURIComponent(organizationId)}`
    : '/api/documents';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Vorgänge konnten nicht geladen werden');
  }
  const data = await res.json();
  return (data.documents || []) as DocumentRecord[];
}

async function apiDeleteDocument(id: string, organizationId?: string): Promise<boolean> {
  const url = organizationId
    ? `/api/documents?id=${encodeURIComponent(id)}&organizationId=${encodeURIComponent(organizationId)}`
    : `/api/documents?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Fehler beim Löschen des Dokuments');
  }
  return true;
}

async function apiUpdateDossier({
  documentId,
  dossier,
  auditOverride,
  actor,
  actorRole,
}: {
  documentId: string;
  dossier: Dossier;
  auditOverride?: {
    fieldKey: string;
    fieldTitle?: string;
    previousStatus: string;
    newStatus: string;
    reason: string;
  };
  actor?: string;
  actorRole?: string;
}): Promise<void> {
  const res = await fetch('/api/analyze', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, dossier, auditOverride, actor, actorRole }),
  });
  if (!res.ok) {
    throw new Error('Fehler beim Speichern der Änderungen');
  }
}

export function useDocuments(organizationId?: string) {
  const queryClient = useQueryClient();
  const queryKey = getDocumentsQueryKey(organizationId);

  const {
    data: documents = [],
    isLoading: isLoadingDocs,
    error: loadError,
    refetch: loadDocuments,
  } = useQuery({
    queryKey,
    queryFn: () => fetchDocuments(organizationId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteDocument(id, organizationId),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<DocumentRecord[]>(queryKey, (prev = []) =>
        prev.filter((d) => d.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateDossierMutation = useMutation({
    mutationFn: apiUpdateDossier,
    onSuccess: (_, variables) => {
      // Nach erfolgreicher Server-Bestätigung (200 OK) den Cache verbindlich aktualisieren
      queryClient.setQueryData<DocumentRecord[]>(queryKey, (prev = []) =>
        prev.map((d) => (d.id === variables.documentId ? { ...d, content: variables.dossier } : d))
      );
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteDocument = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      return false;
    }
  };

  return {
    documents,
    isLoadingDocs,
    loadDocuments,
    loadError,
    deleteDocument,
    updateDossier: updateDossierMutation.mutateAsync,
    isUpdatingDossier: updateDossierMutation.isPending,
  };
}
