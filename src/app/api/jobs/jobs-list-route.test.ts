import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthzError, requirePermission } from '@/lib/auth/require-permission';
import { getJobRepository } from '@/lib/supabase/server';
import { resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import {
  createMockJobRepository,
  createMockDossierRepository,
  createMockKnowledgeRepository,
  createMockAuditRepository,
} from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission, TEST_ORG_ID } from '@/test/fixtures/session-context';
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
    getKnowledgeRepository: () => createMockKnowledgeRepository(),
    getAuditRepository: () => createMockAuditRepository(),
    getServerSupabase: vi.fn(),
  };
});

describe('API Route: /api/jobs (List & Retry)', () => {
  const repo = getJobRepository();

  beforeEach(() => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
  });

  it('GET /api/jobs antwortet bei Datenbankfehler mit fester Meldung ohne Details', async () => {
    vi.spyOn(repo, 'listJobs').mockRejectedValueOnce(new Error('connection to db.internal:5432'));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Fehler beim Laden der Jobs.' });
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
    expect(orphanSpy).toHaveBeenCalledWith(3 * 60 * 1000, expect.any(String));
  });

  it('POST /api/jobs retries a failed job', async () => {
    const job = await repo.createJob(
      {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: 'Failing Job',
      },
      TEST_ORG_ID
    );

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
    const job = await repo.createJob(
      {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: 'x',
      },
      TEST_ORG_ID
    );
    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.FAILED,
      retryCount: 1,
      errorMessage: 'Zeitüberschreitung',
    });

    await POST(
      new NextRequest('http://localhost:3000/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ jobId: job.id }),
      })
    );
    const requeued = await repo.getJobById(job.id);
    expect(requeued?.retryCount).toBe(2);
    expect(requeued?.errorMessage).toBeUndefined();
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
