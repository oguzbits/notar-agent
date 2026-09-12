import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { useDocuments } from './useDocuments';

describe('useDocuments with TanStack Query', () => {
  const mockDocs = [
    { id: 'doc-1', title: 'Vorgang 1', status: 'In Prüfung' },
    { id: 'doc-2', title: 'Vorgang 2', status: 'Entwurfsreif' },
  ];

  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    let currentDocs = [...mockDocs];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === 'DELETE') {
          const urlObj = new URL(url, 'http://localhost');
          const idToDelete = urlObj.searchParams.get('id');
          currentDocs = currentDocs.filter((d) => d.id !== idToDelete);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ documents: currentDocs }),
        });
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads documents via useQuery', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingDocs).toBe(false);
    });

    expect(result.current.documents).toHaveLength(2);
    expect(result.current.documents[0].id).toBe('doc-1');
  });

  it('deletes a document via useMutation and updates query cache', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingDocs).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.deleteDocument('doc-1');
    });

    expect(success).toBe(true);
    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1);
    });
    expect(result.current.documents[0].id).toBe('doc-2');
  });

  it('optimistically updates dossier and handles rollback on network error', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingDocs).toBe(false);
    });

    // Mock PUT error to test rollback
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: false,
            status: 500,
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ documents: mockDocs }),
        });
      })
    );

    const mockUpdatedDossier = createTestImmobilienDossier({
      caseTitle: 'Test Vorgang 1',
    });

    let mutationFailed = false;
    let caughtError: unknown = null;
    await act(async () => {
      try {
        await result.current.updateDossier({
          documentId: 'doc-1',
          dossier: mockUpdatedDossier,
        });
      } catch (err) {
        mutationFailed = true;
        caughtError = err;
      }
    });

    expect(mutationFailed).toBe(true);
    expect(caughtError).toBeInstanceOf(Error);
    // Verified rollback to previous document state
    expect(result.current.documents[0].id).toBe('doc-1');
  });
});
