import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServerAuthClient } from '@/lib/supabase/server-auth';
import { demoUserCredentials } from '@/types/auth';
import { DB_TABLES } from '@/types/database';
import { POST } from './route';

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn(),
}));

const mockCreateServerAuthClient = vi.mocked(createServerAuthClient);

describe('POST /api/auth/demo (1-Klick Demo-Kanzlei Login)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 when Supabase server client is unavailable', async () => {
    mockCreateServerAuthClient.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost:3000/api/auth/demo', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('Authentifizierungsserver nicht verfügbar.');
  });

  it('signs in immediately when demo user already exists', async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'demo-user-123', email: demoUserCredentials.EMAIL },
            session: {},
          },
          error: null,
        }),
        signUp: vi.fn(),
      },
      from: vi.fn(),
    };
    mockCreateServerAuthClient.mockResolvedValueOnce(mockSupabase as never);

    const req = new NextRequest('http://localhost:3000/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ redirectTo: '/dossier' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.user.email).toBe(demoUserCredentials.EMAIL);
    expect(json.redirectTo).toBe('/dossier');
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: demoUserCredentials.EMAIL,
      password: demoUserCredentials.PASSWORD,
    });
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('provisions demo user and organization when user does not exist yet', async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi
          .fn()
          .mockResolvedValueOnce({
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials' },
          })
          .mockResolvedValueOnce({
            data: {
              user: { id: 'new-demo-user-456', email: demoUserCredentials.EMAIL },
              session: {},
            },
            error: null,
          }),
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'new-demo-user-456', email: demoUserCredentials.EMAIL },
          },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === DB_TABLES.ORGANIZATIONS) {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'org-demo-789',
                    name: demoUserCredentials.ORGANIZATION_NAME,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === DB_TABLES.ORGANIZATION_MEMBERS) {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    };
    mockCreateServerAuthClient.mockResolvedValueOnce(mockSupabase as never);

    const req = new NextRequest('http://localhost:3000/api/auth/demo', { method: 'POST' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: demoUserCredentials.EMAIL,
      password: demoUserCredentials.PASSWORD,
      options: {
        data: {
          full_name: demoUserCredentials.FULL_NAME,
          title: demoUserCredentials.TITLE,
        },
      },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith(DB_TABLES.ORGANIZATIONS);
    expect(mockSupabase.from).toHaveBeenCalledWith(DB_TABLES.ORGANIZATION_MEMBERS);
  });
});
