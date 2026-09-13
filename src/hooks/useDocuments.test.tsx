import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { Dossier } from '@/types/dossier';
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
    http.put('/api/analyze', async ({ request }) => {
      const body = (await request.json()) as { documentId: string; dossier: Dossier };
      currentDocs = currentDocs.map((d) =>
        d.id === body.documentId ? { ...d, content: body.dossier } : d
      );
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
    expect(result.current.documents[0]?.id).toBe('doc-1');
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
    expect(result.current.documents[0]?.id).toBe('doc-2');
  });

  it('pessimistically updates query cache only after successful server response', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingDocs).toBe(false);
    });

    const mockUpdatedDossier = createTestImmobilienDossier({
      caseTitle: 'Test Vorgang 1',
    });

    await act(async () => {
      await result.current.updateDossier({
        documentId: 'doc-1',
        dossier: mockUpdatedDossier,
      });
    });

    await waitFor(() => {
      const updated = result.current.documents.find((d) => d.id === 'doc-1');
      expect((updated as { content?: typeof mockUpdatedDossier })?.content?.caseTitle).toBe(
        'Test Vorgang 1'
      );
    });
  });

  it('rejects and preserves state without cache pollution on network error (pessimistic)', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingDocs).toBe(false);
    });

    // Mock PUT error to test failure handling
    server.use(
      http.put('/api/analyze', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const mockUpdatedDossier = createTestImmobilienDossier({
      caseTitle: 'Should Not Be Persisted',
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
    // Verified that state was not prematurely updated
    const doc = result.current.documents.find((d) => d.id === 'doc-1');
    expect((doc as { content?: typeof mockUpdatedDossier })?.content?.caseTitle).toBeUndefined();
  });
});
