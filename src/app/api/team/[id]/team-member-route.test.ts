import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requirePermission } from '@/lib/auth/require-permission';
import { getTeamRepository } from '@/lib/supabase/server';
import { LastNotarError, TeamSelfChangeError } from '@/lib/team/team-repository';
import {
  createMockAuditRepository,
  createMockTeamRepository,
} from '@/test/fixtures/mock-repositories';
import { fakeRequirePermission } from '@/test/fixtures/session-context';
import { AUDIT_ACTIONS } from '@/types/audit';
import { NOTARY_ROLES } from '@/types/organization';
import { PATCH, DELETE } from './route';

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

describe('API Route: /api/team/[id]', () => {
  const repo = getTeamRepository();
  const testOrgId = '550e8400-e29b-41d4-a716-446655440000';
  let memberId: string;

  beforeEach(async () => {
    vi.mocked(requirePermission).mockImplementation(fakeRequirePermission());
    // Clear & seed a member
    const existing = await repo.listMembers(testOrgId);
    for (const m of existing) {
      await repo.removeMember(m.id, testOrgId);
    }

    const created = await repo.inviteMember(
      {
        name: 'Mitarbeiter Test',
        email: 'mitarbeiter@test.de',
        role: NOTARY_ROLES.SACHBEARBEITER,
      },
      testOrgId
    );
    memberId = created.id;
  });

  it('PATCH /api/team/[id] updates the member role', async () => {
    const patchReq = new NextRequest(`http://localhost:3000/api/team/${memberId}`, {
      method: 'PATCH',
      headers: {
        'x-organization-id': testOrgId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: NOTARY_ROLES.NOTARASSESSOR }),
    });

    const res = await PATCH(patchReq, { params: Promise.resolve({ id: memberId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.member.role).toBe(NOTARY_ROLES.NOTARASSESSOR);

    const check = await repo.getMemberById(memberId, testOrgId);
    expect(check?.role).toBe(NOTARY_ROLES.NOTARASSESSOR);
  });

  it('PATCH und DELETE verlangen MANAGE_TEAM: SACHBEARBEITER ändert und entfernt nichts', async () => {
    vi.mocked(requirePermission).mockImplementation(
      fakeRequirePermission(NOTARY_ROLES.SACHBEARBEITER)
    );
    const headers = { 'x-organization-id': testOrgId, 'content-type': 'application/json' };
    const params = { params: Promise.resolve({ id: memberId }) };

    const patched = await PATCH(
      new NextRequest(`http://localhost:3000/api/team/${memberId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role: NOTARY_ROLES.NOTARASSESSOR }),
      }),
      params
    );
    const deleted = await DELETE(
      new NextRequest(`http://localhost:3000/api/team/${memberId}`, { method: 'DELETE', headers }),
      params
    );

    expect([patched.status, deleted.status]).toEqual([403, 403]);
    const check = await repo.getMemberById(memberId, testOrgId);
    expect(check?.role).toBe(NOTARY_ROLES.SACHBEARBEITER);
  });

  const patchRole = () =>
    PATCH(
      new NextRequest(`http://localhost:3000/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'x-organization-id': testOrgId, 'content-type': 'application/json' },
        body: JSON.stringify({ role: NOTARY_ROLES.NOTARASSESSOR }),
      }),
      { params: Promise.resolve({ id: memberId }) }
    );

  it('PATCH schreibt ein Audit-Ereignis mit alter und neuer Rolle', async () => {
    await patchRole();

    const history = await mockAuditRepo.getHistory(`team:${testOrgId}`);
    expect(history.at(-1)).toMatchObject({
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      details: {
        member: {
          memberId,
          previousRole: NOTARY_ROLES.SACHBEARBEITER,
          newRole: NOTARY_ROLES.NOTARASSESSOR,
        },
      },
    });
  });

  it('PATCH: eigene Rolle → 403, letzter Notar → 409', async () => {
    vi.mocked(repo.updateMemberRole)
      .mockRejectedValueOnce(new TeamSelfChangeError())
      .mockRejectedValueOnce(new LastNotarError());

    const self = await patchRole();
    const last = await patchRole();

    expect([self.status, last.status]).toEqual([403, 409]);
    expect((await last.json()).error).toContain('mindestens einen Notar');
  });

  it('DELETE des letzten Notars → 409, Mitglied bleibt', async () => {
    vi.mocked(repo.removeMember).mockRejectedValueOnce(new LastNotarError());

    const res = await DELETE(
      new NextRequest(`http://localhost:3000/api/team/${memberId}`, {
        method: 'DELETE',
        headers: { 'x-organization-id': testOrgId },
      }),
      { params: Promise.resolve({ id: memberId }) }
    );

    expect(res.status).toBe(409);
    expect(await repo.getMemberById(memberId, testOrgId)).not.toBeNull();
  });

  it('PATCH /api/team/[id] returns 404 for non-existent member', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const patchReq = new NextRequest(`http://localhost:3000/api/team/${nonExistentId}`, {
      method: 'PATCH',
      headers: {
        'x-organization-id': testOrgId,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: NOTARY_ROLES.NOTARASSESSOR }),
    });

    const res = await PATCH(patchReq, { params: Promise.resolve({ id: nonExistentId }) });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/team/[id] removes the member', async () => {
    const delReq = new NextRequest(`http://localhost:3000/api/team/${memberId}`, {
      method: 'DELETE',
      headers: { 'x-organization-id': testOrgId },
    });

    const res = await DELETE(delReq, { params: Promise.resolve({ id: memberId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const check = await repo.getMemberById(memberId, testOrgId);
    expect(check).toBeNull();
  });
});
