import { describe, it, expect, vi } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { DELETION_TASK_STATUS } from '@/types/deletion';
import { countPendingDeletionTasks } from './pending-deletions';

function clientReturning(result: { count: number | null; error: { message: string } | null }) {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as never, from, select, eq };
}

describe('countPendingDeletionTasks', () => {
  it('zählt offene Aufgaben in PostgreSQL (nur Kopfzeile, nur PENDING)', async () => {
    const { client, from, select, eq } = clientReturning({ count: 3, error: null });

    await expect(countPendingDeletionTasks(client)).resolves.toBe(3);
    expect(from).toHaveBeenCalledWith(DB_TABLES.DELETION_TASKS);
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(eq).toHaveBeenCalledWith('status', DELETION_TASK_STATUS.PENDING);
  });

  it('wirft bei Datenbankfehler (Fail-Fast)', async () => {
    const { client } = clientReturning({ count: null, error: { message: 'down' } });

    await expect(countPendingDeletionTasks(client)).rejects.toThrow(
      'Supabase countPendingDeletionTasks fehlgeschlagen: down'
    );
  });
});
