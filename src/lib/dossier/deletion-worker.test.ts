import { describe, expect, it, vi } from 'vitest';
import { DELETION_TASK_STATUS } from '@/types/deletion';
import { processDeletionTasks, runRetentionSweep } from './deletion-worker';

const ORG = 'a0000000-0000-4000-8000-000000000001';
const task = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't1',
  organization_id: ORG,
  document_id: 'doc-1',
  storage_path: `${ORG}/datei.pdf`,
  status: DELETION_TASK_STATUS.PENDING,
  attempts: 0,
  ...over,
});

function createAdmin(
  tasks: ReturnType<typeof task>[],
  opts: { removeError?: string; purge?: boolean } = {}
) {
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const remove = vi.fn(async () =>
    opts.removeError
      ? { data: null, error: { message: opts.removeError } }
      : { data: [], error: null }
  );
  const rpc = vi.fn(
    async (
      fn: string,
      _args?: { p_document_id?: string }
    ): Promise<{ data: unknown; error: { message: string } | null }> =>
      fn === 'complete_dossier_purge'
        ? { data: opts.purge ?? true, error: null }
        : { data: [{ id: 'old-1' }, { id: 'old-2' }], error: null }
  );
  const admin = {
    storage: { from: vi.fn(() => ({ remove })) },
    rpc,
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ order: () => ({ limit: async () => ({ data: tasks, error: null }) }) }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => ({
          eq: async () => {
            updates.push({ id, patch });
            return { error: null };
          },
        }),
      }),
    })),
  };
  return { admin: admin as never, updates, remove, rpc };
}

const opts = { batchSize: 10, maxAttempts: 3 };

describe('processDeletionTasks', () => {
  it('entfernt das Objekt, markiert DONE und schließt die Löschung ab', async () => {
    const { admin, updates, remove, rpc } = createAdmin([task()]);
    const result = await processDeletionTasks(admin, opts);
    expect(remove).toHaveBeenCalledWith([`${ORG}/datei.pdf`]);
    expect(updates[0]?.patch).toMatchObject({ status: DELETION_TASK_STATUS.DONE });
    expect(rpc).toHaveBeenCalledWith('complete_dossier_purge', { p_document_id: 'doc-1' });
    expect(result).toEqual({ done: 1, failed: 0, purged: 1 });
  });

  it('löscht nie einen Pfad außerhalb der eigenen Kanzlei', async () => {
    const { admin, updates, remove } = createAdmin([
      task({ storage_path: 'andere-kanzlei/x.pdf' }),
    ]);
    const result = await processDeletionTasks(admin, opts);
    expect(remove).not.toHaveBeenCalled();
    expect(updates[0]?.patch).toMatchObject({ status: DELETION_TASK_STATUS.FAILED });
    expect(result.failed).toBe(1);
  });

  it('wiederholt bei Fehlern und gibt nach maxAttempts auf', async () => {
    const first = createAdmin([task({ attempts: 0 })], { removeError: 'timeout' });
    await processDeletionTasks(first.admin, opts);
    expect(first.updates[0]?.patch).toMatchObject({ attempts: 1, last_error: 'timeout' });
    expect(first.updates[0]?.patch).not.toHaveProperty('status');

    const last = createAdmin([task({ attempts: 2 })], { removeError: 'timeout', purge: false });
    const result = await processDeletionTasks(last.admin, opts);
    expect(last.updates[0]?.patch).toMatchObject({
      status: DELETION_TASK_STATUS.FAILED,
      attempts: 3,
    });
    expect(result).toMatchObject({ done: 0, failed: 1, purged: 0 });
  });
});

describe('runRetentionSweep', () => {
  it('löscht jedes fällige Dossier über die Systemfunktion', async () => {
    const { admin, rpc } = createAdmin([]);
    const result = await runRetentionSweep(admin, { limit: 50 });
    expect(rpc).toHaveBeenCalledWith('list_retention_expired_dossiers', { p_limit: 50 });
    expect(rpc).toHaveBeenCalledWith('delete_dossier_system', { p_document_id: 'old-1' });
    expect(rpc).toHaveBeenCalledWith('delete_dossier_system', { p_document_id: 'old-2' });
    expect(result).toEqual({ deleted: 2, failed: [] });
  });

  it('meldet fehlgeschlagene Dossiers, statt sie zu verschweigen', async () => {
    const { admin, rpc } = createAdmin([]);
    rpc.mockImplementation(async (fn: string, args?: { p_document_id?: string }) =>
      fn === 'list_retention_expired_dossiers'
        ? { data: [{ id: 'old-1' }, { id: 'old-2' }], error: null }
        : args?.p_document_id === 'old-1'
          ? { data: null, error: { message: 'Verarbeitung läuft' } }
          : { data: {}, error: null }
    );
    const result = await runRetentionSweep(admin, { limit: 50 });
    expect(result).toEqual({
      deleted: 1,
      failed: [{ documentId: 'old-1', error: 'Verarbeitung läuft' }],
    });
  });
});
