import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createOrgRoute, PUT as updateOrgRoute } from '@/app/api/organization/route';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { DB_TABLES } from '@/types/database';
import { NOTARY_ROLES } from '@/types/organization';

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn(),
}));

const mockCreateServerAuthClient = vi.mocked(createServerAuthClient);

describe('POST /api/organization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Notariat Hamburg',
        officialSeat: 'Hamburg',
        chamberDistrict: 'Hamburgische Notarkammer',
      }),
    });
    const res = await createOrgRoute(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when payload is invalid', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'test@notar.de' } },
          error: null,
        }),
      },
    };
    mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    });
    const res = await createOrgRoute(req);
    expect(res.status).toBe(400);
  });

  it('creates organization and assigns user as NOTAR', async () => {
    const mockUser = { id: 'u1', email: 'test@notar.de' };
    const mockCreatedOrg = {
      id: 'o-new-123',
      name: 'Notariat am Rathausmarkt',
      official_seat: 'Hamburg',
      chamber_district: 'Hamburgische Notarkammer',
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      rpc: vi.fn().mockResolvedValue({ data: mockCreatedOrg, error: null }),
      from: vi.fn((table: string) => {
        if (table === DB_TABLES.ORGANIZATIONS) {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockCreatedOrg, error: null }),
          };
        }
        if (table === DB_TABLES.ORGANIZATION_MEMBERS) {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };
    mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

    const req = new NextRequest('http://localhost:3000/api/organization', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Notariat am Rathausmarkt',
        officialSeat: 'Hamburg',
        chamberDistrict: 'Hamburgische Notarkammer',
      }),
    });
    const res = await createOrgRoute(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.organization.id).toBe('o-new-123');
    expect(json.role).toBe(NOTARY_ROLES.NOTAR);
  });

  describe('PUT /api/organization', () => {
    it('returns 403 when user is not NOTAR or ADMIN', async () => {
      const mockUser = { id: 'u2', email: 'sachbearbeiter@notar.de' };
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === DB_TABLES.ORGANIZATION_MEMBERS) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { organization_id: 'org-1', role: NOTARY_ROLES.SACHBEARBEITER },
                error: null,
              }),
            };
          }
          return {};
        }),
      };
      mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

      const req = new NextRequest('http://localhost:3000/api/organization', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Neuer Kanzleiname',
          officialSeat: 'Hamburg',
          chamberDistrict: 'Hamburgische Notarkammer',
        }),
      });
      const res = await updateOrgRoute(req);
      expect(res.status).toBe(403);
    });

    it('updates organization successfully when user is NOTAR', async () => {
      const mockUser = { id: 'u1', email: 'notar@notar.de' };
      const mockUpdatedOrg = {
        id: 'org-1',
        name: 'Notariat Öztürk & Partner',
        official_seat: 'Hamburg',
        chamber_district: 'Hamburgische Notarkammer',
      };

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === DB_TABLES.ORGANIZATION_MEMBERS) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { organization_id: 'org-1', role: NOTARY_ROLES.NOTAR },
                error: null,
              }),
            };
          }
          if (table === DB_TABLES.ORGANIZATIONS) {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockUpdatedOrg, error: null }),
            };
          }
          return {};
        }),
      };
      mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

      const req = new NextRequest('http://localhost:3000/api/organization', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Notariat Öztürk & Partner',
          officialSeat: 'Hamburg',
          chamberDistrict: 'Hamburgische Notarkammer',
        }),
      });
      const res = await updateOrgRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.organization.name).toBe('Notariat Öztürk & Partner');
    });
  });
});
