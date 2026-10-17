import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthzError, requirePermission } from '@/lib/auth/require-permission';
import { getDossierFieldsRecord } from '@/lib/dossier/state';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import {
  createMockAuditRepository,
  createMockDossierRepository,
} from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission, TEST_ORG_ID } from '@/test/fixtures/session-context';
import { AUDIT_ACTIONS } from '@/types/audit';
import { Dossier, FIELD_STATUS } from '@/types/dossier';
import { NOTARY_ROLES } from '@/types/organization';
import { POST } from './route';

vi.mock('@/lib/auth/require-permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-permission')>()),
  requirePermission: vi.fn(),
}));
vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn().mockResolvedValue({}),
}));

const dossierRepo = createMockDossierRepository();
const auditRepo = createMockAuditRepository();
vi.mock('@/lib/supabase/server', () => ({
  getDossierRepository: () => dossierRepo,
  getAuditRepository: () => auditRepo,
}));

let docId = '';

function reviewOf(record: { content: Dossier } | null, fieldKey: string) {
  if (!record) throw new Error('Vorgang nicht gespeichert');
  return getDossierFieldsRecord(record.content)[fieldKey]?.review;
}

function call(fieldKey: string, body: unknown = { fieldKey }) {
  const req = new NextRequest(`http://localhost:3000/api/documents/${docId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: docId }) });
}

describe('API Route: POST /api/documents/[id]/confirm', () => {
  beforeEach(async () => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
    docId = (
      await dossierRepo.save(
        createTestImmobilienDossier({
          fieldStatusMap: { verkaeufer: FIELD_STATUS.VERIFIED, kaeufer: FIELD_STATUS.NEEDS_REVIEW },
        }),
        TEST_ORG_ID
      )
    ).id;
  });

  it('bestätigt ein belegtes Feld mit Akteur aus der Sitzung und schreibt genau einen Audit-Eintrag', async () => {
    const appendSpy = vi.spyOn(auditRepo, 'appendEvent');
    const res = await call('verkaeufer', { fieldKey: 'verkaeufer', confirmedBy: 'Fälscher' });

    expect(res.status).toBe(200);
    expect((await res.json()).review.confirmedBy).toBe('Test Notar');
    const stored = await dossierRepo.findById(docId, TEST_ORG_ID);
    expect(reviewOf(stored, 'verkaeufer')?.confirmedBy).toBe('Test Notar');
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy.mock.calls[0]?.[0]).toMatchObject({
      action: AUDIT_ACTIONS.FIELD_CONFIRMED,
      actor: 'Test Notar',
    });
  });

  it('lehnt ein nicht belegtes Feld ab, ohne Vermerk und ohne Audit-Eintrag', async () => {
    const appendSpy = vi.spyOn(auditRepo, 'appendEvent');
    const res = await call('kaeufer');

    expect(res.status).toBe(409);
    const stored = await dossierRepo.findById(docId, TEST_ORG_ID);
    expect(reviewOf(stored, 'kaeufer')).toBeUndefined();
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('verlangt das Recht zur Statusänderung (403) und eine Sitzung (401)', async () => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission(NOTARY_ROLES.ADMIN));
    expect((await call('verkaeufer')).status).toBe(403);
    vi.mocked(requirePermission).mockRejectedValueOnce(new AuthzError(401, 'Nicht angemeldet.'));
    expect((await call('verkaeufer')).status).toBe(401);
  });
});
