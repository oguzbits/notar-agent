import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach } from 'vitest';
import { getTeamRepository } from '@/lib/supabase/server';
import { NOTARY_ROLES } from '@/types/organization';
import { GET, POST } from './route';

describe('API Route: /api/team', () => {
  const repo = getTeamRepository();
  const testOrgId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
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
