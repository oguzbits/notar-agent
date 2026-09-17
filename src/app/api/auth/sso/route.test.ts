import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSO_PROVIDERS } from '@/types/auth';
import { POST } from './route';

const mockSignInWithOAuth = vi.fn();

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signInWithOAuth: mockSignInWithOAuth,
      },
    })
  ),
}));

describe('SSO Route (POST /api/auth/sso)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initiates Google OAuth flow and returns redirect URL', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?...' },
      error: null,
    });

    const req = new NextRequest('http://localhost:3000/api/auth/sso', {
      method: 'POST',
      body: JSON.stringify({ provider: SSO_PROVIDERS.GOOGLE, redirectTo: '/' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.url).toContain('https://accounts.google.com');
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: SSO_PROVIDERS.GOOGLE,
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?next=%2F',
      },
    });
  });

  it('rejects invalid or unsupported providers', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/sso', {
      method: 'POST',
      body: JSON.stringify({ provider: 'facebook' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
