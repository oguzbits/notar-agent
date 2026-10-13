'use client';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { DB_TABLES } from '@/types/database';
import { DocumentRecord, DocumentListItem } from '@/types/document';
import { Dossier } from '@/types/dossier';

export const DOCUMENTS_QUERY_KEY = [DB_TABLES.DOCUMENTS] as const;
export const DOCUMENT_DETAIL_QUERY_PREFIX = 'document-detail' as const;

export function getDocumentsQueryKey(organizationId?: string) {
  return organizationId ? ([DB_TABLES.DOCUMENTS, organizationId] as const) : DOCUMENTS_QUERY_KEY;
}

export function getDocumentDetailQueryKey(id?: string, organizationId?: string) {
  return organizationId
    ? ([DOCUMENT_DETAIL_QUERY_PREFIX, id, organizationId] as const)
    : ([DOCUMENT_DETAIL_QUERY_PREFIX, id] as const);
}

async function fetchDocuments(organizationId?: string): Promise<DocumentListItem[]> {
  const url = organizationId
    ? `/api/documents?organizationId=${encodeURIComponent(organizationId)}`
    : '/api/documents';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Vorgänge konnten nicht geladen werden');
  }
  const data = await res.json();
  return (data.documents || []) as DocumentListItem[];
}

async function fetchDocumentById(
  id: string,
  organizationId?: string
): Promise<DocumentRecord | null> {
  const url = organizationId
    ? `/api/documents?id=${encodeURIComponent(id)}&organizationId=${encodeURIComponent(organizationId)}`
    : `/api/documents?id=${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Vorgang konnte nicht geladen werden');
  }
  const data = await res.json();
  return (data.document || null) as DocumentRecord | null;
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

export interface UseDocumentsOptions {
  enabled?: boolean;
}

export function useDocuments(organizationId?: string, options?: UseDocumentsOptions) {
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
    enabled: options?.enabled,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteDocument(id, organizationId),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<DocumentListItem[]>(queryKey, (prev = []) =>
        prev.filter((d) => d.id !== deletedId)
      );
      queryClient.removeQueries({
        queryKey: getDocumentDetailQueryKey(deletedId, organizationId),
      });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateDossierMutation = useMutation({
    mutationFn: apiUpdateDossier,
    onSuccess: (_, variables) => {
      // 1. Detail-Cache aktualisieren, falls geladen
      const detailKey = getDocumentDetailQueryKey(variables.documentId, organizationId);
      queryClient.setQueryData<DocumentRecord | null>(detailKey, (prev) =>
        prev ? { ...prev, content: variables.dossier } : prev
      );
      // 2. Tabellen-Liste und Detail invalidieren
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: detailKey });
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

export interface UseDocumentOptions {
  enabled?: boolean;
}

/**
 * Lädt ein vollständiges Vorgangs-Dossier gezielt on demand nach ID.
 * Verhindert das Vorabladen riesiger JSONB-Dossiers bei reinen Tabellenansichten.
 */
export function useDocument(
  documentId?: string | null,
  organizationId?: string,
  options?: UseDocumentOptions
) {
  const queryKey = getDocumentDetailQueryKey(documentId || undefined, organizationId);

  const {
    data: document = null,
    isLoading: isLoadingDocument,
    error: documentError,
    refetch: loadDocument,
  } = useQuery({
    queryKey,
    queryFn: () =>
      documentId ? fetchDocumentById(documentId, organizationId) : Promise.resolve(null),
    enabled: (options?.enabled ?? true) && Boolean(documentId),
    staleTime: 60 * 1000,
  });

  return {
    document,
    isLoadingDocument,
    documentError,
    loadDocument,
  };
}
