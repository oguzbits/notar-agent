import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requirePermission } from '@/lib/auth/require-permission';
import { getTeamRepository } from '@/lib/supabase/server';
import {
  createMockAuditRepository,
  createMockTeamRepository,
} from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission } from '@/test/fixtures/session-context';
import { AUDIT_ACTIONS } from '@/types/audit';
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

  it('POST /api/team invites a new team member and persists it', async () => {
    const invitePayload = {
      name: 'Dr. Test Notar',
      email: 'test@notariat.de',
      role: NOTARY_ROLES.NOTAR,
      title: 'Notar',
    };

    const postReq = new NextRequest('http://localhost:3000/api/team', {
      method: 'POST',
      headers: {
        'x-organization-id': testOrgId,
        'content-type': 'application/json',
      },
      body: JSON.stringify(invitePayload),
    });

    const res = await POST(postReq);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.member).toBeDefined();
    expect(data.member.name).toBe('Dr. Test Notar');
    expect(data.member.email).toBe('test@notariat.de');
    expect(data.member.role).toBe(NOTARY_ROLES.NOTAR);

    // Verify GET returns the new member
    const getReq = new NextRequest('http://localhost:3000/api/team', {
      headers: { 'x-organization-id': testOrgId },
    });
    const listRes = await GET(getReq);
    const listData = await listRes.json();
    expect(listData.members).toHaveLength(1);
    expect(listData.members[0].id).toBe(data.member.id);

    const history = await mockAuditRepo.getHistory(`team:${testOrgId}`);
    expect(history.at(-1)).toMatchObject({
      action: AUDIT_ACTIONS.MEMBER_INVITED,
      details: { member: { memberId: data.member.id, newRole: NOTARY_ROLES.NOTAR } },
    });
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

  it('POST /api/team rejects invalid payload with 400', async () => {
    const postReq = new NextRequest('http://localhost:3000/api/team', {
      method: 'POST',
      headers: {
        'x-organization-id': testOrgId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '' }),
    });

    const res = await POST(postReq);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
