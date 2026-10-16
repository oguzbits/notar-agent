import { describe, it, expect, vi } from 'vitest';
import { resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { GET } from './route';

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn().mockResolvedValue({}),
  resolveSessionOrganizationId: vi.fn(),
}));

describe('GET /api/eval/report', () => {
  it('verweigert ohne Sitzung mit 401', async () => {
    vi.mocked(resolveSessionOrganizationId).mockResolvedValueOnce(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('liefert mit Sitzung 200 oder 404, nie 401', async () => {
    vi.mocked(resolveSessionOrganizationId).mockResolvedValueOnce(
      'a0000000-0000-4000-8000-000000000001'
    );
    const res = await GET();
    expect([200, 404]).toContain(res.status);
  });
});
