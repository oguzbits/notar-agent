import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as worker from '@/lib/dossier/deletion-worker';
import { GET } from './route';

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));
vi.mock('@/env', () => ({ getEnv: () => ({ CRON_SECRET: process.env.TEST_CRON_SECRET }) }));
const prune = vi.hoisted(() => vi.fn(async () => 2));
vi.mock('@/lib/jobs/job-repository', () => ({
  SupabaseJobRepository: class {
    pruneCompletedJobs = prune;
  },
}));
vi.mock('@/lib/supabase/admin', () => ({ createServiceRoleClient: vi.fn(() => ({})) }));
vi.mock('@/lib/dossier/deletion-worker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dossier/deletion-worker')>()),
  processDeletionTasks: vi.fn(async () => ({ done: 1, failed: 0, purged: 1 })),
  runRetentionSweep: vi.fn(async () => ({ deleted: 0, failed: [] })),
}));

const call = (auth?: string) =>
  GET(
    new NextRequest('http://localhost:3000/api/cron/deletion', {
      headers: auth ? { authorization: auth } : {},
    })
  );

describe('GET /api/cron/deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEST_CRON_SECRET = 'geheim';
  });

  it.each([undefined, 'Bearer falsch', 'geheim', 'Bearer geheim2'])(
    'lehnt den Aufruf mit Autorisierung %s ab',
    async (auth) => {
      expect((await call(auth)).status).toBe(401);
      expect(worker.processDeletionTasks).not.toHaveBeenCalled();
      expect(prune).not.toHaveBeenCalled();
    }
  );

  it('lehnt alles ab, solange kein Secret konfiguriert ist', async () => {
    delete process.env.TEST_CRON_SECRET;
    expect((await call('Bearer ')).status).toBe(401);
    expect((await call('Bearer undefined')).status).toBe(401);
  });

  it('arbeitet Aufgaben und Fristen mit korrektem Secret ab', async () => {
    const res = await call('Bearer geheim');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      tasks: { done: 1 },
      retention: { deleted: 0 },
      jobsPruned: 2,
    });
  });

  it('meldet dauerhaft fehlgeschlagene Löschaufgaben ohne Inhalte an Sentry', async () => {
    vi.mocked(worker.processDeletionTasks).mockResolvedValueOnce({ done: 0, failed: 2, purged: 0 });
    await call('Bearer geheim');
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Löschlauf mit dauerhaften Fehlern',
      expect.objectContaining({ level: 'error', extra: { tasks: 2, retention: 0 } })
    );
  });

  it('meldet fehlgeschlagene Fristlöschungen an Sentry', async () => {
    vi.mocked(worker.runRetentionSweep).mockResolvedValueOnce({
      deleted: 0,
      failed: [{ documentId: 'doc-1', error: 'x' }],
    });
    await call('Bearer geheim');
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Löschlauf mit dauerhaften Fehlern',
      expect.objectContaining({ extra: { tasks: 0, retention: 1 } })
    );
  });

  it('meldet nichts, wenn keine Aufgabe fehlgeschlagen ist', async () => {
    await call('Bearer geheim');
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
