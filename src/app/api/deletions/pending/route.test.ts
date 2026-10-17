import { describe, it, expect, vi, beforeEach } from 'vitest';
import { countPendingDeletionTasks } from '@/lib/dossier/pending-deletions';
import { resolveSessionOrganizationId } from '@/lib/supabase/server-auth';
import { GET } from './route';

vi.mock('@/lib/dossier/pending-deletions', () => ({ countPendingDeletionTasks: vi.fn() }));
vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn().mockResolvedValue({}),
  resolveSessionOrganizationId: vi.fn(),
}));

describe('GET /api/deletions/pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveSessionOrganizationId).mockResolvedValue('org-1');
  });

  it('liefert die Zahl offener Aufgaben', async () => {
    vi.mocked(countPendingDeletionTasks).mockResolvedValueOnce(2);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pendingFiles: 2 });
  });

  it('antwortet 401 ohne Sitzung oder Kanzlei und fragt die Datenbank nicht', async () => {
    vi.mocked(resolveSessionOrganizationId).mockResolvedValueOnce(undefined);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(countPendingDeletionTasks).not.toHaveBeenCalled();
  });

  it('antwortet 500 bei Datenbankfehler', async () => {
    vi.mocked(countPendingDeletionTasks).mockRejectedValueOnce(new Error('down'));

    expect((await GET()).status).toBe(500);
  });
});
