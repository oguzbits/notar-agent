import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach } from 'vitest';
import { getTeamRepository } from '@/lib/supabase/server';
import { NOTARY_ROLES } from '@/types/organization';
import { PATCH, DELETE } from './route';

describe('API Route: /api/team/[id]', () => {
  const repo = getTeamRepository();
  const testOrgId = '550e8400-e29b-41d4-a716-446655440000';
  let memberId: string;

  beforeEach(async () => {
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
