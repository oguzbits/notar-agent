import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyImmobilienDossier } from '@/lib/dossier-defaults';
import { DocumentRecord, CASE_STATUS } from '@/lib/supabase/repository';
import * as serverDb from '@/lib/supabase/server';
import { GET, DELETE } from './route';

vi.mock('@/lib/supabase/server', () => ({
  fetchDossierRecords: vi.fn(),
  fetchDossierRecordById: vi.fn(),
  deleteDossierRecord: vi.fn(),
}));

describe('Documents API Route (/api/documents)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(serverDb.fetchDossierRecords).toHaveBeenCalledWith('org-123');
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
    it('deletes document and returns 200 OK', async () => {
      vi.mocked(serverDb.deleteDossierRecord).mockResolvedValueOnce(true);

      const req = new NextRequest('http://localhost:3000/api/documents?id=doc-1', {
        headers: { 'x-organization-id': 'org-123' },
      });
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(serverDb.deleteDossierRecord).toHaveBeenCalledWith('doc-1', 'org-123');
    });

    it('returns 400 when id is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents');
      const res = await DELETE(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('ID fehlt.');
    });

    it('returns 500 when delete fails', async () => {
      vi.mocked(serverDb.deleteDossierRecord).mockResolvedValueOnce(false);

      const req = new NextRequest('http://localhost:3000/api/documents?id=doc-1');
      const res = await DELETE(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Vorgang konnte nicht gelöscht werden.');
    });
  });
});
