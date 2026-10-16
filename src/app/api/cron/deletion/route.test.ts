import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as worker from '@/lib/dossier/deletion-worker';
import { GET } from './route';

vi.mock('@/env', () => ({ getEnv: () => ({ CRON_SECRET: process.env.TEST_CRON_SECRET }) }));
vi.mock('@/lib/supabase/admin', () => ({ createServiceRoleClient: vi.fn(() => ({})) }));
vi.mock('@/lib/dossier/deletion-worker', () => ({
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
    expect(await res.json()).toMatchObject({ tasks: { done: 1 }, retention: { deleted: 0 } });
  });
});
