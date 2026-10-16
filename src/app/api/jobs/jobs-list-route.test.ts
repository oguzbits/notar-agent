import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthzError, requirePermission } from '@/lib/auth/require-permission';
import { getJobRepository } from '@/lib/supabase/server';
import { resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import {
  createMockJobRepository,
  createMockDossierRepository,
} from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission } from '@/test/fixtures/session-context';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS } from '@/types/jobs';
import { GET, POST } from './route';

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
const mockDossierRepo = createMockDossierRepository();

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>();
  return {
    ...actual,
    getJobRepository: () => mockJobRepo,
    getDossierRepository: () => mockDossierRepo,
    getServerSupabase: vi.fn(),
  };
});

describe('API Route: /api/jobs (List & Retry)', () => {
  const repo = getJobRepository();

  beforeEach(() => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
  });

  it('POST /api/jobs verlangt UPLOAD_DOCUMENTS und fasst ohne Sitzung nichts an (401)', async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new AuthzError(401, 'Nicht authentifiziert oder keine Kanzlei zugeordnet.')
    );

    const req = new NextRequest('http://localhost:3000/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ jobId: 'irgendein-job' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(requirePermission).toHaveBeenCalledWith(
      null,
      PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
      expect.objectContaining({ route: 'POST /api/jobs' })
    );
  });

  it('GET /api/jobs returns list of all jobs', async () => {
    const job = await repo.createJob(
      {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: 'Test List Job',
      },
      'a0000000-0000-4000-8000-000000000001'
    );

    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.jobs)).toBe(true);
    const found = data.jobs.find((j: { id: string }) => j.id === job.id);
    expect(found).toBeDefined();
    expect(found.payload.notes).toBe('Test List Job');
  });

  it('GET /api/jobs verweigert ohne Sitzung mit 401', async () => {
    vi.mocked(resolveSessionOrganizationId).mockResolvedValueOnce(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('GET /api/jobs triggers self-healing for orphan/stuck jobs', async () => {
    const orphanSpy = vi.spyOn(repo, 'recoverOrphanJobs');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(orphanSpy).toHaveBeenCalledWith(3 * 60 * 1000);
  });

  it('POST /api/jobs retries a failed job', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Failing Job',
    });

    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.FAILED,
      errorMessage: 'Network timeout',
      retryCount: 1,
    });

    const req = new NextRequest('http://localhost:3000/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ jobId: job.id }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobId).toBe(job.id);
    expect(data.status).toBe(JOB_STATUS.PENDING);

    const updatedJob = await repo.getJobById(job.id);
    expect(updatedJob?.status).toBe(JOB_STATUS.PROCESSING);
  });

  it.each([JOB_STATUS.PROCESSING, JOB_STATUS.COMPLETED, JOB_STATUS.PENDING])(
    'POST /api/jobs verweigert Wiederholung eines Jobs im Status %s mit 409',
    async (status) => {
      const job = await repo.createJob({
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: 'x',
      });
      await repo.updateJobStatus(job.id, { status });

      const res = await POST(
        new NextRequest('http://localhost:3000/api/jobs', {
          method: 'POST',
          body: JSON.stringify({ jobId: job.id }),
        })
      );
      expect(res.status).toBe(409);
      expect((await repo.getJobById(job.id))?.status).toBe(status);
    }
  );

  it('POST /api/jobs verweigert Wiederholung nach Ausschöpfen der Versuche mit 409', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'x',
    });
    await repo.updateJobStatus(job.id, { status: JOB_STATUS.FAILED, retryCount: job.maxRetries });

    const res = await POST(
      new NextRequest('http://localhost:3000/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ jobId: job.id }),
      })
    );
    expect(res.status).toBe(409);
  });

  it('POST /api/jobs zählt jede Wiederholung', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'x',
    });
    await repo.updateJobStatus(job.id, { status: JOB_STATUS.FAILED, retryCount: 1 });

    await POST(
      new NextRequest('http://localhost:3000/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ jobId: job.id }),
      })
    );
    expect((await repo.getJobById(job.id))?.retryCount).toBe(2);
  });

  it('POST /api/jobs returns 400 when jobId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('POST /api/jobs returns 404 when job does not exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ jobId: 'non-existent-uuid' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
