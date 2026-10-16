import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requirePermission } from '@/lib/auth/require-permission';
import { processDeletionTasks } from '@/lib/dossier/deletion-worker';
import { createEmptyImmobilienDossier } from '@/lib/dossier-defaults';
import { DocumentRecord, CASE_STATUS, DossierNotFoundError } from '@/lib/supabase/repository';
import * as serverDb from '@/lib/supabase/server';
import * as serverAuth from '@/lib/supabase/server-auth';
import { fakeRequirePermission } from '@/test/fixtures/session-context';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { DELETION_REASONS } from '@/types/deletion';
import { NOTARY_ROLES } from '@/types/organization';
import { GET, DELETE } from './route';

vi.mock('@/lib/auth/require-permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-permission')>()),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/dossier/deletion-worker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dossier/deletion-worker')>()),
  processDeletionTasks: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({ createServiceRoleClient: () => ({}) }));

vi.mock('@/lib/supabase/server', () => ({
  fetchDossierRecords: vi.fn(),
  fetchDossierRecordById: vi.fn(),
  deleteDossierRecord: vi.fn(),
}));

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn().mockResolvedValue(null),
  resolveSessionOrganizationId: vi.fn(
    async (_client, override) => override ?? 'a0000000-0000-4000-8000-000000000001'
  ),
}));

describe('Documents API Route (/api/documents)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
  });

  const sampleRecord: DocumentRecord = {
    id: 'doc-1',
    title: 'Kaufvertrag.pdf',
    status: CASE_STATUS.DRAFT_READY,
    created_at: new Date().toISOString(),
    organizationId: '550e8400-e29b-41d4-a716-446655440000',
    content: createEmptyImmobilienDossier('Kaufvertrag.pdf'),
  };

  describe('GET /api/documents', () => {
    it('returns list of documents with 200 OK', async () => {
      const mockDocs: DocumentRecord[] = [sampleRecord];
      vi.mocked(serverDb.fetchDossierRecords).mockResolvedValueOnce(mockDocs);

      const req = new NextRequest('http://localhost:3000/api/documents', {
        headers: { 'x-organization-id': 'org-123' },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.documents).toEqual(mockDocs);
      expect(serverDb.fetchDossierRecords).toHaveBeenCalledWith('org-123', null);
    });

    it('resolves organizationId from session if not provided in request', async () => {
      const mockDocs: DocumentRecord[] = [sampleRecord];
      vi.mocked(serverDb.fetchDossierRecords).mockResolvedValueOnce(mockDocs);
      vi.mocked(serverAuth.resolveSessionOrganizationId).mockResolvedValueOnce('org-session-456');

      const req = new NextRequest('http://localhost:3000/api/documents');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(serverDb.fetchDossierRecords).toHaveBeenCalledWith('org-session-456', null);
    });

    it('returns single document when id is provided', async () => {
      vi.mocked(serverDb.fetchDossierRecordById).mockResolvedValueOnce(sampleRecord);

      const req = new NextRequest('http://localhost:3000/api/documents?id=doc-1');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.document).toEqual(sampleRecord);
    });

    it('returns 404 when single document not found', async () => {
      vi.mocked(serverDb.fetchDossierRecordById).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/documents?id=not-found');
      const res = await GET(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Vorgang nicht gefunden.');
    });

    it('returns 500 when database throws error', async () => {
      vi.mocked(serverDb.fetchDossierRecords).mockRejectedValueOnce(new Error('DB Timeout'));

      const req = new NextRequest('http://localhost:3000/api/documents');
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('DB Timeout');
    });
  });

  describe('DELETE /api/documents', () => {
    const receipt = { documentId: 'doc-1', deletedRows: { documents: 1 }, storageTasks: 0 };
    const deleteRequest = (
      query = '?id=doc-1',
      body: unknown = { reason: DELETION_REASONS.SONSTIGES }
    ) =>
      new NextRequest(`http://localhost:3000/api/documents${query}`, {
        method: 'DELETE',
        headers: { 'x-organization-id': 'org-123', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('löscht mit Grund und liefert den Nachweis', async () => {
      vi.mocked(serverDb.deleteDossierRecord).mockResolvedValueOnce(receipt);

      const res = await DELETE(deleteRequest());

      expect(res.status).toBe(200);
      expect((await res.json()).receipt).toEqual(receipt);
      expect(serverDb.deleteDossierRecord).toHaveBeenCalledWith(
        'doc-1',
        DELETION_REASONS.SONSTIGES,
        null
      );
    });

    it('arbeitet nach dem Löschen die Storage-Aufgaben genau dieser Akte ab', async () => {
      vi.mocked(serverDb.deleteDossierRecord).mockResolvedValueOnce({
        ...receipt,
        storageTasks: 2,
      });

      const res = await DELETE(deleteRequest());

      expect(res.status).toBe(200);
      await vi.waitFor(() =>
        expect(processDeletionTasks).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ documentId: 'doc-1' })
        )
      );
    });

    it('startet den Worker nicht, wenn keine Storage-Aufgaben vorgemerkt sind', async () => {
      vi.mocked(serverDb.deleteDossierRecord).mockResolvedValueOnce(receipt);
      await DELETE(deleteRequest());
      await Promise.resolve();
      expect(processDeletionTasks).not.toHaveBeenCalled();
    });

    it('antwortet 200, auch wenn der Nachlauf fehlschlägt', async () => {
      vi.mocked(serverDb.deleteDossierRecord).mockResolvedValueOnce({
        ...receipt,
        storageTasks: 1,
      });
      vi.mocked(processDeletionTasks).mockRejectedValueOnce(new Error('Storage down'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const res = await DELETE(deleteRequest());

      expect(res.status).toBe(200);
      await vi.waitFor(() => expect(processDeletionTasks).toHaveBeenCalled());
    });

    it('verlangt DELETE_DOSSIER und löscht für SACHBEARBEITER nichts', async () => {
      vi.mocked(requirePermission).mockImplementation(
        fakeRequirePermission(NOTARY_ROLES.SACHBEARBEITER)
      );

      const res = await DELETE(deleteRequest());

      expect(res.status).toBe(403);
      expect(requirePermission).toHaveBeenCalledWith(
        null,
        PERMISSION_ACTIONS.DELETE_DOSSIER,
        expect.objectContaining({ route: 'DELETE /api/documents' })
      );
      expect(serverDb.deleteDossierRecord).not.toHaveBeenCalled();
      expect(processDeletionTasks).not.toHaveBeenCalled();
    });

    it('returns 400 when id is missing', async () => {
      const res = await DELETE(deleteRequest(''));

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('ID fehlt.');
    });

    it.each([{}, { reason: 'weil' }])('lehnt ungültigen Löschgrund %j mit 400 ab', async (body) => {
      const res = await DELETE(deleteRequest('?id=doc-1', body));

      expect(res.status).toBe(400);
      expect(serverDb.deleteDossierRecord).not.toHaveBeenCalled();
    });

    it('antwortet 404 für unbekannte Vorgänge', async () => {
      vi.mocked(serverDb.deleteDossierRecord).mockRejectedValueOnce(
        new DossierNotFoundError('doc-1')
      );

      const res = await DELETE(deleteRequest());

      expect(res.status).toBe(404);
    });

    it('antwortet 500, wenn das Löschen fehlschlägt', async () => {
      vi.mocked(serverDb.deleteDossierRecord).mockRejectedValueOnce(new Error('DB down'));

      const res = await DELETE(deleteRequest());

      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe('DB down');
    });
  });
});
