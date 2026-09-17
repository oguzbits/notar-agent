import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

const mockExchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    })
  ),
}));

describe('Auth Callback Route (GET /auth/callback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges code for session and redirects to target URL', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const req = new NextRequest('http://localhost:3000/auth/callback?code=valid-code&next=/');
    const res = await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-code');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects to /login with error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValueOnce({
      error: { message: 'Ungültiger Code' },
    });

    const req = new NextRequest('http://localhost:3000/auth/callback?code=bad-code');
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?error=sso_failed');
  });

  it('redirects to /login if code parameter is missing', async () => {
    const req = new NextRequest('http://localhost:3000/auth/callback');
    const res = await GET(req);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login?error=missing_code');
  });
});
