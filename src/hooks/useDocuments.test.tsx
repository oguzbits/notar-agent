import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { CASE_STATUS } from '@/lib/supabase/repository';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { DELETION_REASONS } from '@/types/deletion';
import { Dossier } from '@/types/dossier';
import { useDocuments, useDocument } from './useDocuments';

describe('useDocuments with TanStack Query & MSW', () => {
  const mockDocs = [
    { id: 'doc-1', title: 'Vorgang 1', status: CASE_STATUS.IN_PROGRESS },
    { id: 'doc-2', title: 'Vorgang 2', status: CASE_STATUS.DRAFT_READY },
  ];

  let currentDocs = [...mockDocs];

  const server = setupServer(
    http.get('/api/documents', ({ request }) => {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (id) {
        const found = currentDocs.find((d) => d.id === id);
        if (!found) return new HttpResponse(null, { status: 404 });
        return HttpResponse.json({ document: found });
      }
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
      success = await result.current.deleteDocument('doc-1', DELETION_REASONS.SONSTIGES);
    });

    expect(success).toBe(true);
    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1);
    });
    expect(result.current.documents[0]?.id).toBe('doc-2');
  });

  it('rolls back optimistically deleted document if server responds with error', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingDocs).toBe(false);
      expect(result.current.documents).toHaveLength(2);
    });

    server.use(
      http.delete('/api/documents', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    let success = true;
    await act(async () => {
      success = await result.current.deleteDocument('doc-1', DELETION_REASONS.SONSTIGES);
    });

    expect(success).toBe(false);
    await waitFor(() => {
      expect(result.current.documents).toHaveLength(2);
    });
    expect(result.current.documents.some((d) => d.id === 'doc-1')).toBe(true);
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

  it('scopes query and fetches with organizationId parameter when passed', async () => {
    let requestedUrl = '';
    server.use(
      http.get('/api/documents', ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ documents: [{ id: 'org-doc-1', title: 'Kanzleidokument' }] });
      })
    );

    const { result } = renderHook(() => useDocuments('org-test-uuid'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoadingDocs).toBe(false);
    });

    expect(requestedUrl).toContain('organizationId=org-test-uuid');
    expect(result.current.documents).toHaveLength(1);
    expect(result.current.documents[0]?.id).toBe('org-doc-1');
  });

  it('respects enabled option and defers fetching until enabled is true', async () => {
    let fetchCalled = false;
    server.use(
      http.get('/api/documents', () => {
        fetchCalled = true;
        return HttpResponse.json({ documents: [] });
      })
    );

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useDocuments('org-test-uuid', { enabled }),
      {
        wrapper,
        initialProps: { enabled: false },
      }
    );

    expect(result.current.isLoadingDocs).toBe(false);
    expect(result.current.documents).toEqual([]);
    expect(fetchCalled).toBe(false);

    rerender({ enabled: true });

    await waitFor(() => {
      expect(fetchCalled).toBe(true);
    });
  });

  describe('useDocument hook (on-demand detail loading)', () => {
    it('returns null and does not fetch when documentId is null or undefined', async () => {
      const { result } = renderHook(() => useDocument(null), { wrapper });

      expect(result.current.document).toBeNull();
      expect(result.current.isLoadingDocument).toBe(false);
    });

    it('loads a single document by ID with 200 OK', async () => {
      const { result } = renderHook(() => useDocument('doc-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoadingDocument).toBe(false);
      });

      expect(result.current.document).toBeDefined();
      expect(result.current.document?.id).toBe('doc-1');
      expect(result.current.document?.title).toBe('Vorgang 1');
    });

    it('returns null without throwing when document is not found (404)', async () => {
      const { result } = renderHook(() => useDocument('non-existing-doc'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoadingDocument).toBe(false);
      });

      expect(result.current.document).toBeNull();
      expect(result.current.documentError).toBeNull();
    });
  });
});
