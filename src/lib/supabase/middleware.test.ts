import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateSession } from './middleware';

const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@/env', () => ({
  validateEnv: vi.fn(() => ({
    NEXT_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_SUPABASE_PUBLISHABLE_KEY: 'sb-publishable-test-key',
  })),
}));

describe('updateSession (Supabase Proxy Middleware)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows unauthenticated requests to /auth/callback without redirecting to /login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const req = new NextRequest('http://localhost:3000/auth/callback?code=oauth-code-123&next=/');
    const res = await updateSession(req);

    // Should NOT redirect to /login
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows unauthenticated requests to /login and /register', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const reqLogin = new NextRequest('http://localhost:3000/login');
    const resLogin = await updateSession(reqLogin);
    expect(resLogin.headers.get('location')).toBeNull();

    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const reqRegister = new NextRequest('http://localhost:3000/register');
    const resRegister = await updateSession(reqRegister);
    expect(resRegister.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated users trying to access protected routes to /login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const req = new NextRequest('http://localhost:3000/');
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects authenticated users on /login to dashboard /', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@notar.de' } },
      error: null,
    });

    const req = new NextRequest('http://localhost:3000/login');
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('allows authenticated users to pass through /auth/callback without forcing redirect to dashboard', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@notar.de' } },
      error: null,
    });

    const req = new NextRequest('http://localhost:3000/auth/callback?code=oauth-code-123&next=/');
    const res = await updateSession(req);

    expect(res.headers.get('location')).toBeNull();
  });
});
