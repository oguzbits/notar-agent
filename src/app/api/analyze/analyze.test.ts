import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthzError, requirePermission } from '@/lib/auth/require-permission';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import {
  createMockJobRepository,
  createMockDossierRepository,
  createMockWorkflowRepository,
} from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission } from '@/test/fixtures/session-context';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { CASE_TYPES, FIELD_STATUS } from '@/types/dossier';
import { JOB_RATE_LIMIT, JOB_STATUS } from '@/types/jobs';
import { NOTARY_ROLES } from '@/types/organization';
import { POST, PUT } from './route';

vi.mock('@/lib/auth/require-permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-permission')>()),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/supabase/server-auth', async () => {
  const { NOTARY_ROLES } = await import('@/types/organization');
  return {
    createServerAuthClient: vi.fn().mockResolvedValue({}),
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
const mockWorkflowRepo = createMockWorkflowRepository();

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>();
  return {
    ...actual,
    getJobRepository: () => mockJobRepo,
    getDossierRepository: () => mockDossierRepo,
    getWorkflowRepository: () => mockWorkflowRepo,
    getServerSupabase: vi.fn(),
  };
});

beforeEach(() => {
  vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
});

describe('API Route: POST /api/analyze Guardrails & Validation', () => {
  it('sollte Status 400 liefern, wenn weder Dateien noch Notizen übermittelt werden', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        files: [],
        notes: '',
        caseType: CASE_TYPES.IMMOBILIENKAUF,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('Keine Dokumente oder Notizen');
  });

  it('sollte Status 400 liefern, wenn ein leeres Body-Objekt gesendet wird', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('sollte Status 400 liefern, wenn ungültiger caseType übermittelt wird', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        files: [{ name: 'test.pdf', type: 'application/pdf', size: 100 }],
        caseType: 'INVALID_TYPE',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('sollte Status 500 liefern, wenn kein API-Key hinterlegt ist', async () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevAnthropic = process.env.ANTHROPIC_API_KEY;
    const prevGoogleGen = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    try {
      const req = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          files: [{ name: 'test.pdf', type: 'application/pdf', size: 100, content: 'data' }],
          caseType: CASE_TYPES.IMMOBILIENKAUF,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Kein KI-API-Key konfiguriert');
    } finally {
      if (prevGemini) process.env.GEMINI_API_KEY = prevGemini;
      if (prevAnthropic) process.env.ANTHROPIC_API_KEY = prevAnthropic;
      if (prevGoogleGen) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevGoogleGen;
    }
  });

  it('sollte Status 202 Accepted mit jobId liefern, wenn async=true übergeben wird', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';

    try {
      const req = new NextRequest('http://localhost:3000/api/analyze?async=true', {
        method: 'POST',
        body: JSON.stringify({
          files: [{ name: 'test.pdf', type: 'application/pdf', size: 100, content: 'data' }],
          caseType: CASE_TYPES.IMMOBILIENKAUF,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.jobId).toBeDefined();
      expect(data.status).toBe(JOB_STATUS.PENDING);
      expect(data.pollUrl).toBe(`/api/jobs/${data.jobId}`);
    } finally {
      if (prevKey) {
        process.env.GEMINI_API_KEY = prevKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });
});

describe('API Route: PUT /api/analyze Guardrails & Validation', () => {
  it('sollte Status 400 liefern, wenn documentId oder dossier fehlen', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('PUT mit auditOverride verlangt OVERRIDE_FIELD_STATUS: ADMIN darf nicht, nichts wird gespeichert', async () => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission(NOTARY_ROLES.ADMIN));
    const updateSpy = vi.spyOn(mockDossierRepo, 'update');
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'PUT',
      body: JSON.stringify({
        documentId: 'doc-test-123',
        dossier: createTestImmobilienDossier(),
        auditOverride: {
          fieldKey: 'verkaeufer',
          previousStatus: FIELD_STATUS.NEEDS_REVIEW,
          newStatus: FIELD_STATUS.VERIFIED,
          reason: 'Original lag vor',
        },
      }),
    });

    const res = await PUT(req);

    expect(res.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(
      {},
      PERMISSION_ACTIONS.OVERRIDE_FIELD_STATUS,
      expect.objectContaining({ route: 'PUT /api/analyze' })
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('PUT ohne auditOverride verlangt UPLOAD_DOCUMENTS', async () => {
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'PUT',
      body: JSON.stringify({ documentId: 'doc-test-123', dossier: createTestImmobilienDossier() }),
    });

    const res = await PUT(req);

    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith(
      {},
      PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
      expect.objectContaining({ route: 'PUT /api/analyze' })
    );
  });

  it('POST verlangt UPLOAD_DOCUMENTS und startet ohne Sitzung keinen Job (401)', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    vi.mocked(requirePermission).mockRejectedValueOnce(
      new AuthzError(401, 'Nicht authentifiziert oder keine Kanzlei zugeordnet.')
    );

    try {
      const req = new NextRequest('http://localhost:3000/api/analyze?async=true', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Testnotiz', caseType: CASE_TYPES.IMMOBILIENKAUF }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      expect(requirePermission).toHaveBeenCalledWith(
        {},
        PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
        expect.objectContaining({ route: 'POST /api/analyze' })
      );
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it('sollte Status 200 liefern, wenn documentId und valides Dossier gesendet werden', async () => {
    const validDossier = createTestImmobilienDossier();
    const req = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'PUT',
      body: JSON.stringify({
        documentId: 'doc-test-123',
        dossier: validDossier,
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('sollte Status 429 liefern, wenn das Stundenkontingent der Kanzlei erreicht ist', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    vi.mocked(mockJobRepo.countJobsSince).mockResolvedValueOnce(JOB_RATE_LIMIT.MAX_JOBS_PER_WINDOW);
    try {
      const req = new NextRequest('http://localhost:3000/api/analyze?async=true', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Testnotiz', caseType: CASE_TYPES.IMMOBILIENKAUF }),
      });
      const res = await POST(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeDefined();
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });
});
