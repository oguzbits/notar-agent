import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const limit = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ select: () => ({ limit }) }) }),
}));

const env = { NEXT_SUPABASE_URL: 'https://x.supabase.co', NEXT_SUPABASE_PUBLISHABLE_KEY: 'pk' };
const getEnv = vi.fn();
vi.mock('@/env', () => ({ getEnv: () => getEnv() }));

import { GET } from './route';

beforeEach(() => {
  getEnv.mockReturnValue(env);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/health', () => {
  it('liefert 200 und ok, wenn die Datenbank antwortet (auch leer durch RLS)', async () => {
    limit.mockResolvedValue({ data: [], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('liefert 503 bei Fehlerantwort der Datenbank, ohne Fehlertext', async () => {
    limit.mockResolvedValue({ data: null, error: { message: 'geheim: Tabelle x' } });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).toBe('{"status":"fehler"}');
  });

  it('liefert 503, wenn der Client wirft', async () => {
    limit.mockRejectedValue(new Error('geheim'));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain('geheim');
  });

  it('liefert 503 bei fehlender Konfiguration', async () => {
    getEnv.mockReturnValue({});
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
