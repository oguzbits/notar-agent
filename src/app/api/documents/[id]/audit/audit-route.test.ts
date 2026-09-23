import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PUT } from '@/app/api/analyze/route';
import { GET as getAuditRoute } from '@/app/api/documents/[id]/audit/route';
import { updateDossierFieldStatus } from '@/lib/dossier/state';
import { getAuditRepository, getDossierRepository } from '@/lib/supabase/server';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import {
  createMockDossierRepository,
  createMockAuditRepository,
} from '@/test/fixtures/mock-repositories';
import { AUDIT_ACTIONS } from '@/types/audit';
import { FIELD_STATUS } from '@/types/dossier';

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

describe('Audit Trail API Route & PUT /api/analyze Integration', () => {
  const docId = 'test-audit-doc-123';

  beforeEach(async () => {
    const dossierRepo = getDossierRepository();
    const dummyDossier = createTestImmobilienDossier();
    await dossierRepo.update(docId, dummyDossier);
  });

  it('records an audit event upon PUT /api/analyze when auditOverride is supplied', async () => {
    const dossierRepo = getDossierRepository();
    const existing = await dossierRepo.findById(docId);
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
    expect(overrideEvent?.actor).toBe('Notar Dr. Mustermann');
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
