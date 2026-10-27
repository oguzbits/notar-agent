import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requirePermission } from '@/lib/auth/require-permission';
import { getTeamRepository } from '@/lib/supabase/server';
import {
  createMockAuditRepository,
  createMockTeamRepository,
} from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission } from '@/test/fixtures/session-context';
import { PERMISSION_ACTIONS } from '@/types/auth';
import { NOTARY_ROLES } from '@/types/organization';
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

const mockTeamRepo = createMockTeamRepository();
const mockAuditRepo = createMockAuditRepository();

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>();
  return {
    ...actual,
    getTeamRepository: () => mockTeamRepo,
    getAuditRepository: () => mockAuditRepo,
    getServerSupabase: vi.fn(),
  };
});

describe('API Route: /api/team', () => {
  const repo = getTeamRepository();
  const testOrgId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
    // Clear previous members
    const existing = await repo.listMembers(testOrgId);
    for (const m of existing) {
      await repo.removeMember(m.id, testOrgId);
    }
  });

  it('GET /api/team returns empty list when no members exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/team', {
      headers: { 'x-organization-id': testOrgId },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.members).toEqual([]);
  });

  it('POST /api/team antwortet 501 mit deutscher Meldung und legt kein Mitglied an', async () => {
    const postReq = new NextRequest('http://localhost:3000/api/team', {
      method: 'POST',
      headers: { 'x-organization-id': testOrgId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Test Notar',
        email: 'test@notariat.de',
        role: NOTARY_ROLES.NOTAR,
      }),
    });

    const res = await POST(postReq);

    expect(res.status).toBe(501);
    expect((await res.json()).error).toContain('noch nicht verfügbar');
    expect(await mockTeamRepo.listMembers(testOrgId)).toEqual([]);
  });

  it('POST /api/team verlangt MANAGE_TEAM und lädt für SACHBEARBEITER nicht ein', async () => {
    vi.mocked(requirePermission).mockImplementation(
      fakeRequirePermission(NOTARY_ROLES.SACHBEARBEITER)
    );
    const postReq = new NextRequest('http://localhost:3000/api/team', {
      method: 'POST',
      headers: { 'x-organization-id': testOrgId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Test Notar',
        email: 'test@notariat.de',
        role: NOTARY_ROLES.NOTAR,
      }),
    });

    const res = await POST(postReq);

    expect(res.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(
      null,
      PERMISSION_ACTIONS.MANAGE_TEAM,
      expect.objectContaining({ route: 'POST /api/team' })
    );
    expect(await repo.listMembers(testOrgId)).toHaveLength(0);
  });
});
