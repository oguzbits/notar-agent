import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { REQUEST_ID_HEADER } from '@/lib/observability/request-id';
import { proxy } from './proxy';

const mockGetUser = vi.fn();
let cookiesToSet: { name: string; value: string; options?: object }[] = [];

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(
    (_url: string, _key: string, opts: { cookies: { setAll: (c: unknown) => void } }) => ({
      auth: {
        getUser: async () => {
          // Sitzungserneuerung: setAll erzeugt die Antwort neu
          if (cookiesToSet.length > 0) opts.cookies.setAll(cookiesToSet);
          return mockGetUser();
        },
      },
    })
  ),
}));

vi.mock('@/env', () => ({
  validateEnv: vi.fn(() => ({
    NEXT_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_SUPABASE_PUBLISHABLE_KEY: 'sb-publishable-test-key',
  })),
}));

// NextResponse.next({ request }) meldet geänderte Request-Header als x-middleware-request-*
const forwarded = (res: Response) => res.headers.get(`x-middleware-request-${REQUEST_ID_HEADER}`);

describe('proxy: Request-Kennung', () => {
  it('setzt die Kennung auf Antwort und auf die Request-Header der Route', async () => {
    cookiesToSet = [];
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
    const res = await proxy(new NextRequest('http://localhost:3000/api/health'));
    const id = res.headers.get(REQUEST_ID_HEADER);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(forwarded(res)).toBe(id);
  });

  it('übernimmt eine gültige eigene Kennung', async () => {
    cookiesToSet = [];
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
    const res = await proxy(
      new NextRequest('http://localhost:3000/api/health', {
        headers: { [REQUEST_ID_HEADER]: 'client-req-0001' },
      })
    );
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe('client-req-0001');
    expect(forwarded(res)).toBe('client-req-0001');
  });

  it('ersetzt eine ungültige Kennung (Log-Injection)', async () => {
    cookiesToSet = [];
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
    const res = await proxy(
      new NextRequest('http://localhost:3000/api/health', {
        headers: { [REQUEST_ID_HEADER]: 'x'.repeat(200) },
      })
    );
    const id = res.headers.get(REQUEST_ID_HEADER);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(forwarded(res)).toBe(id);
  });

  it('bleibt erhalten, wenn die Sitzungserneuerung die Antwort neu erzeugt', async () => {
    cookiesToSet = [{ name: 'sb-token', value: 'neu' }];
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
    const res = await proxy(new NextRequest('http://localhost:3000/api/health'));
    const id = res.headers.get(REQUEST_ID_HEADER);
    expect(id).toBeTruthy();
    expect(forwarded(res)).toBe(id);
    expect(res.cookies.get('sb-token')?.value).toBe('neu');
  });

  it('steht auch auf einer Weiterleitung', async () => {
    cookiesToSet = [];
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await proxy(new NextRequest('http://localhost:3000/'));
    expect(res.status).toBe(307);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });
});
