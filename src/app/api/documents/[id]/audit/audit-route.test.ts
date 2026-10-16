import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PUT } from '@/app/api/analyze/route';
import { GET as getAuditRoute } from '@/app/api/documents/[id]/audit/route';
import { requirePermission } from '@/lib/auth/require-permission';
import { updateDossierFieldStatus } from '@/lib/dossier/state';
import { getAuditRepository, getDossierRepository } from '@/lib/supabase/server';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import {
  createMockDossierRepository,
  createMockAuditRepository,
} from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission } from '@/test/fixtures/session-context';
import { AUDIT_ACTIONS } from '@/types/audit';
import { FIELD_STATUS } from '@/types/dossier';

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

const mockDossierRepo = createMockDossierRepository();
const mockAuditRepo = createMockAuditRepository();

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>();
  return {
    ...actual,
    getDossierRepository: () => mockDossierRepo,
    getAuditRepository: () => mockAuditRepo,
    getServerSupabase: vi.fn(),
  };
});

const TEST_ORG_ID = 'a0000000-0000-4000-8000-000000000001';

describe('Audit Trail API Route & PUT /api/analyze Integration', () => {
  const docId = 'test-audit-doc-123';

  beforeEach(async () => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
    const dossierRepo = getDossierRepository();
    const dummyDossier = createTestImmobilienDossier();
    await dossierRepo.update(docId, dummyDossier, TEST_ORG_ID);
  });

  it('records an audit event upon PUT /api/analyze when auditOverride is supplied', async () => {
    const dossierRepo = getDossierRepository();
    const existing = await dossierRepo.findById(docId, TEST_ORG_ID);
    expect(existing).not.toBeNull();

    const updatedDossier = updateDossierFieldStatus(
      existing!.content,
      'verkaeufer',
      FIELD_STATUS.VERIFIED
    );

    const reqBody = {
      documentId: docId,
      dossier: updatedDossier,
      auditOverride: {
        fieldKey: 'verkaeufer',
        fieldTitle: 'Verkäufer',
        previousStatus: FIELD_STATUS.NEEDS_REVIEW,
        newStatus: FIELD_STATUS.VERIFIED,
        reason: 'Erbschein lag im Original vor',
      },
      actor: 'Notar Dr. Mustermann',
    };

    const putReq = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'PUT',
      body: JSON.stringify(reqBody),
    });

    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(200);

    const auditRepo = getAuditRepository();
    const history = await auditRepo.getHistory(docId);
    expect(history.length).toBeGreaterThanOrEqual(1);

    const overrideEvent = history[history.length - 1];
    expect(overrideEvent?.action).toBe(AUDIT_ACTIONS.USER_STATUS_OVERRIDE);
    expect(overrideEvent?.actor).toBe('Test Notar');
    expect(overrideEvent?.details?.override?.reason).toBe('Erbschein lag im Original vor');

    // GET /api/documents/[id]/audit abfragen
    const getReq = new NextRequest(`http://localhost:3000/api/documents/${docId}/audit`);
    const getRes = await getAuditRoute(getReq, {
      params: Promise.resolve({ id: docId }),
    });

    expect(getRes.status).toBe(200);
    const auditData = await getRes.json();
    expect(auditData.documentId).toBe(docId);
    expect(auditData.integrity.valid).toBe(true);
    expect(auditData.history.length).toBe(history.length);
  });
});
