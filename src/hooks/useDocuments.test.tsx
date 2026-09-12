import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { useDocuments } from './useDocuments';

describe('useDocuments with TanStack Query & MSW', () => {
  const mockDocs = [
    { id: 'doc-1', title: 'Vorgang 1', status: 'In Prüfung' },
    { id: 'doc-2', title: 'Vorgang 2', status: 'Entwurfsreif' },
  ];

  let currentDocs = [...mockDocs];

  const server = setupServer(
    http.get('/api/documents', () => {
      return HttpResponse.json({ documents: currentDocs });
    }),
    http.delete('/api/documents', ({ request }) => {
      const url = new URL(request.url);
      const idToDelete = url.searchParams.get('id');
      currentDocs = currentDocs.filter((d) => d.id !== idToDelete);
      return HttpResponse.json({ success: true });
    }),
    http.put('/api/analyze', () => {
      return HttpResponse.json({ success: true });
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
    currentDocs = [...mockDocs];
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
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

    // Mock PUT error to test rollback with MSW
    server.use(
      http.put('/api/analyze', () => {
        return new HttpResponse(null, { status: 500 });
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
