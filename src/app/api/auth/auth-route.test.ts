import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { GET as meRoute } from '@/app/api/auth/me/route';
import { POST as registerRoute } from '@/app/api/auth/register/route';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { NOTARY_ROLES } from '@/types/organization';

// Mock server auth client
vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn(),
}));

const mockCreateServerAuthClient = vi.mocked(createServerAuthClient);

describe('Auth API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('returns 400 when body does not match LoginRequestSchema', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('logs in successfully with email and password', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { user: { id: 'u1', email: 'test@notar.de' }, session: {} },
            error: null,
          }),
        },
      };
      mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@notar.de', password: 'validPassword123' }),
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@notar.de',
        password: 'validPassword123',
      });
    });

    it('sends magic link when password is not provided', async () => {
      const mockSupabase = {
        auth: {
          signInWithOtp: vi.fn().mockResolvedValue({
            data: {},
            error: null,
          }),
        },
      };
      mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@notar.de' }),
      });
      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.magicLinkSent).toBe(true);
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('signs out and returns 200', async () => {
      const mockSupabase = {
        auth: {
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
      };
      mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

      const req = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
      });
      const res = await logoutRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when user is not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

      const req = new NextRequest('http://localhost:3000/api/auth/me');
      const res = await meRoute(req);
      expect(res.status).toBe(401);
    });

    it('returns user profile, role, and organization when authenticated', async () => {
      const mockUser = { id: 'a0000000-0000-4000-8000-000000000001', email: 'notar@kanzlei.de' };
      const mockProfile = {
        id: 'a0000000-0000-4000-8000-000000000001',
        full_name: 'Dr. Notar',
        title: 'Notar',
      };
      const mockOrg = {
        id: 'b0000000-0000-4000-8000-000000000002',
        name: 'Notariat Westfalen',
        official_seat: 'Münster',
        chamber_district: 'Westfälische Notarkammer',
      };

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
            };
          }
          if (table === 'organization_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { role: NOTARY_ROLES.NOTAR, organization: mockOrg },
                error: null,
              }),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      };
      mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

      const req = new NextRequest('http://localhost:3000/api/auth/me');
      const res = await meRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user.name).toBe('Dr. Notar');
      expect(json.user.role).toBe(NOTARY_ROLES.NOTAR);
      expect(json.organization.name).toBe('Notariat Westfalen');
    });
  });

  describe('POST /api/auth/register', () => {
    it('returns 400 when registration data is invalid', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid' }),
      });
      const res = await registerRoute(req);
      expect(res.status).toBe(400);
    });

    it('creates auth user, creates organization, and links user as NOTAR', async () => {
      const mockUser = { id: 'u123', email: 'neu@kanzlei.de' };
      const mockOrg = {
        id: 'o123',
        name: 'Notariat Neu',
        official_seat: 'Köln',
        chamber_district: 'Rheinische Notarkammer',
      };

      const mockSupabase = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'organizations') {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockOrg, error: null }),
            };
          }
          if (table === 'organization_members') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      };
      mockCreateServerAuthClient.mockResolvedValue(mockSupabase as never);

      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'neu@kanzlei.de',
          password: 'Password123!',
          fullName: 'Dr. Neuer Notar',
          title: 'Notar',
          organizationName: 'Notariat Neu',
          officialSeat: 'Köln',
          chamberDistrict: 'Rheinische Notarkammer',
        }),
      });
      const res = await registerRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.organization.id).toBe('o123');
    });
  });
});
