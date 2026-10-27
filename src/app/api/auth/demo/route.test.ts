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

  it('reuses the existing organization of an anonymous session', async () => {
    const mockSupabase = {
      auth: {
        signInAnonymously: vi.fn().mockResolvedValue({
          data: { user: { id: 'demo-user-123' } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { organization_id: 'o1' }, error: null }),
      })),
      rpc: vi.fn(),
    };
    mockCreateServerAuthClient.mockResolvedValueOnce(mockSupabase as never);

    const req = new NextRequest('http://localhost:3000/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ redirectTo: '/dossier' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.redirectTo).toBe('/dossier');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('gibt bei fremdem Weiterleitungsziel nur / zurück', async () => {
    const mockSupabase = {
      auth: {
        signInAnonymously: vi.fn().mockResolvedValue({
          data: { user: { id: 'demo-user-123' } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { organization_id: 'o1' }, error: null }),
      })),
      rpc: vi.fn(),
    };
    mockCreateServerAuthClient.mockResolvedValueOnce(mockSupabase as never);

    const res = await POST(
      new NextRequest('http://localhost:3000/api/auth/demo', {
        method: 'POST',
        body: JSON.stringify({ redirectTo: '//evil.example' }),
      })
    );

    expect((await res.json()).redirectTo).toBe('/');
  });

  it('returns 500 when the demo organization cannot be created', async () => {
    const mockSupabase = {
      auth: {
        signInAnonymously: vi.fn().mockResolvedValue({
          data: { user: { id: 'new-demo-user-456' } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
    };
    mockCreateServerAuthClient.mockResolvedValueOnce(mockSupabase as never);

    const res = await POST(
      new NextRequest('http://localhost:3000/api/auth/demo', { method: 'POST' })
    );

    expect(res.status).toBe(500);
    expect(mockSupabase.from).toHaveBeenCalledWith(DB_TABLES.ORGANIZATION_MEMBERS);
    expect(demoUserCredentials.ORGANIZATION_NAME).toBeTruthy();
  });
});
