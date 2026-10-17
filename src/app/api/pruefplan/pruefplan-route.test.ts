import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthzError, requirePermission } from '@/lib/auth/require-permission';
import { createMockKnowledgeRepository } from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission, TEST_ORG_ID } from '@/test/fixtures/session-context';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { CASE_TYPES } from '@/types/dossier';
import { GET } from './route';

vi.mock('@/lib/auth/require-permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-permission')>()),
  requirePermission: vi.fn(),
}));
vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn().mockResolvedValue({}),
}));

const knowledgeRepo = createMockKnowledgeRepository();
vi.mock('@/lib/supabase/server', () => ({
  getKnowledgeRepository: () => knowledgeRepo,
}));

const call = (query: string) => GET(new NextRequest(`http://localhost:3000/api/pruefplan${query}`));

describe('API Route: GET /api/pruefplan', () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
    vi.mocked(knowledgeRepo.getStatutoryRules).mockClear();
  });

  it('liefert Pflichtfelder und Regeln der eigenen Kanzlei aus der Wissensbasis', async () => {
    const res = await call(`?caseType=${CASE_TYPES.IMMOBILIENKAUF}`);

    expect(res.status).toBe(200);
    const plan = await res.json();
    expect(plan.fields.length).toBeGreaterThan(0);
    expect(plan.rules.length).toBeGreaterThan(0);
    expect(knowledgeRepo.getStatutoryRules).toHaveBeenCalledWith(TEST_ORG_ID);
    expect(requirePermission).toHaveBeenCalledWith(
      expect.anything(),
      PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
      expect.objectContaining({ route: 'GET /api/pruefplan' })
    );
  });

  it('lehnt eine unbekannte Vorgangsart ab (400) und fragt dann keine Regeln ab', async () => {
    expect((await call('?caseType=UNBEKANNT')).status).toBe(400);
    expect(knowledgeRepo.getStatutoryRules).not.toHaveBeenCalled();
  });

  it('verlangt eine Sitzung (401)', async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new AuthzError(401, 'Nicht angemeldet.'));
    expect((await call(`?caseType=${CASE_TYPES.IMMOBILIENKAUF}`)).status).toBe(401);
    expect(knowledgeRepo.getStatutoryRules).not.toHaveBeenCalled();
  });
});
