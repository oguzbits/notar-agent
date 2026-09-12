'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DocumentRecord } from '@/lib/supabase/server';
import { Dossier } from '@/types/dossier';

export const DOCUMENTS_QUERY_KEY = ['documents'] as const;

async function fetchDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch('/api/documents');
  if (!res.ok) {
    throw new Error('Vorgänge konnten nicht geladen werden');
  }
  const data = await res.json();
  return (data.documents || []) as DocumentRecord[];
}

async function apiDeleteDocument(id: string): Promise<boolean> {
  const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Fehler beim Löschen des Dokuments');
  }
  return true;
}

async function apiUpdateDossier({
  documentId,
  dossier,
}: {
  documentId: string;
  dossier: Dossier;
}): Promise<void> {
  const res = await fetch('/api/analyze', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, dossier }),
  });
  if (!res.ok) {
    throw new Error('Fehler beim Speichern der Änderungen');
  }
}

export function useDocuments() {
  const queryClient = useQueryClient();

  const {
    data: documents = [],
    isLoading: isLoadingDocs,
    error: loadError,
    refetch: loadDocuments,
  } = useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: fetchDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteDocument,
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<DocumentRecord[]>(DOCUMENTS_QUERY_KEY, (prev = []) =>
        prev.filter((d) => d.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });

  const updateDossierMutation = useMutation({
    mutationFn: apiUpdateDossier,
    onMutate: async (newVariables) => {
      // Laufende Refetches abbrechen, damit sie das optimistische Update nicht überschreiben
      await queryClient.cancelQueries({ queryKey: DOCUMENTS_QUERY_KEY });

      // Vorherigen Cache-Zustand für Snapshot sichern
      const previousDocuments = queryClient.getQueryData<DocumentRecord[]>(DOCUMENTS_QUERY_KEY);

      // Optimistisches Update im Query-Cache anwenden
      if (previousDocuments) {
        queryClient.setQueryData<DocumentRecord[]>(DOCUMENTS_QUERY_KEY, (prev = []) =>
          prev.map((d) =>
            d.id === newVariables.documentId ? { ...d, content: newVariables.dossier } : d
          )
        );
      }

      return { previousDocuments };
    },
    onError: (_err, _variables, context) => {
      // Bei Fehler: Auf vorherigen Zustand zurückrollen
      if (context?.previousDocuments) {
        queryClient.setQueryData<DocumentRecord[]>(DOCUMENTS_QUERY_KEY, context.previousDocuments);
      }
    },
    onSettled: () => {
      // Nach Abschluss oder Fehler sicherheitshalber im Hintergrund synchronisieren
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });

  const setOptimisticDossier = (documentId: string, dossier: Dossier) => {
    queryClient.setQueryData<DocumentRecord[]>(DOCUMENTS_QUERY_KEY, (prev = []) =>
      prev.map((d) => (d.id === documentId ? { ...d, content: dossier } : d))
    );
  };

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
    setOptimisticDossier,
    isLoadingDocs,
    loadDocuments,
    loadError,
    deleteDocument,
    updateDossier: updateDossierMutation.mutateAsync,
    isUpdatingDossier: updateDossierMutation.isPending,
  };
}
