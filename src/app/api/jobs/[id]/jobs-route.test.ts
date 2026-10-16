import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requirePermission } from '@/lib/auth/require-permission';
import { getJobRepository } from '@/lib/supabase/server';
import { createMockJobRepository } from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission } from '@/test/fixtures/session-context';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS, JOB_STAGES } from '@/types/jobs';
import { NOTARY_ROLES } from '@/types/organization';
import { GET, DELETE } from './route';

vi.mock('@/lib/auth/require-permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-permission')>()),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/supabase/server-auth', async () => {
  const { NOTARY_ROLES } = await import('@/types/organization');
  return {
    createServerAuthClient: vi.fn().mockResolvedValue(null),
    resolveSessionOrganizationId: vi.fn(
      async (_client: unknown, requested?: string) =>
        requested ?? 'a0000000-0000-4000-8000-000000000001'
    ),
    resolveSessionActor: vi
      .fn()
      .mockResolvedValue({ label: 'Test Notar', role: NOTARY_ROLES.NOTAR }),
  };
});

const mockJobRepo = createMockJobRepository();

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>();
  return {
    ...actual,
    getJobRepository: () => mockJobRepo,
    getServerSupabase: vi.fn(),
  };
});

describe('API Route: GET /api/jobs/[id]', () => {
  const repo = getJobRepository();

  beforeEach(async () => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
  });

  it('returns 404 when job is not found', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/non-existing-id');
    const res = await GET(req, { params: Promise.resolve({ id: 'non-existing-id' }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('nicht gefunden');
  });

  it('returns 200 with job details when job exists', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Testauftrag',
    });

    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.PROCESSING,
      stage: JOB_STAGES.EXTRACTION,
      progressDetails: {
        currentStep: 2,
        totalSteps: 4,
        processedUnits: 1,
        totalUnits: 2,
        currentActivity: 'Beteiligte extrahieren...',
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/jobs/${job.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: job.id }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(job.id);
    expect(data.status).toBe(JOB_STATUS.PROCESSING);
    expect(data.stage).toBe(JOB_STAGES.EXTRACTION);
    expect(data.progressDetails?.currentStep).toBe(2);
    expect(data.progressDetails?.currentActivity).toBe('Beteiligte extrahieren...');
  });

  it('automatically transitions stale PROCESSING job to FAILED when lease expired', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Hängengebliebener Job',
    });

    const fourMinutesAgoIso = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.PROCESSING,
      lockedAt: fourMinutesAgoIso,
    });

    const req = new NextRequest(`http://localhost:3000/api/jobs/${job.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: job.id }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(job.id);
    expect(data.status).toBe(JOB_STATUS.FAILED);
    expect(data.errorMessage).toBe('Verarbeitung unterbrochen. Bitte Vorgang erneut starten.');
  });

  describe('DELETE /api/jobs/[id]', () => {
    it('returns 404 when job to delete is not found', async () => {
      const req = new NextRequest('http://localhost:3000/api/jobs/missing-id', {
        method: 'DELETE',
      });
      const res = await DELETE(req, { params: Promise.resolve({ id: 'missing-id' }) });

      expect(res.status).toBe(404);
    });

    it('verlangt DELETE_DOSSIER und löscht für SACHBEARBEITER nichts', async () => {
      vi.mocked(requirePermission).mockImplementation(
        fakeRequirePermission(NOTARY_ROLES.SACHBEARBEITER)
      );
      const job = await repo.createJob({
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: 'Geschützter Job',
      });

      const req = new NextRequest(`http://localhost:3000/api/jobs/${job.id}`, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: job.id }) });

      expect(res.status).toBe(403);
      expect(requirePermission).toHaveBeenCalledWith(
        null,
        PERMISSION_ACTIONS.DELETE_DOSSIER,
        expect.objectContaining({ route: 'DELETE /api/jobs/[id]' })
      );
      expect(await repo.getJobById(job.id)).not.toBeNull();
    });

    it('deletes job and returns 200 success', async () => {
      const job = await repo.createJob({
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: 'Zu löschender Job',
      });

      const req = new NextRequest(`http://localhost:3000/api/jobs/${job.id}`, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: job.id }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(await repo.getJobById(job.id)).toBeNull();
    });
  });
});
