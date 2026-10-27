import { describe, it, expect, vi } from 'vitest';
import { logFailure } from '@/lib/observability/logger';
import { DB_TABLES } from '@/types/database';
import { CASE_TYPES } from '@/types/dossier';
import { CreateJobPayload, JOB_STATUS } from '@/types/jobs';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';

vi.mock('@/lib/observability/logger', () => ({ logFailure: vi.fn() }));

describe('SupabaseJobRepository (Fail-Fast SSOT)', () => {
  const samplePayload: CreateJobPayload = {
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    files: [],
    notes: 'Fail-Fast Test',
  };

  it('fails fast and throws when Supabase insert encounters an error in createJob', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'Connection Timeout' } }),
          }),
        }),
      }),
    };

    const { SupabaseJobRepository } = await import('./job-repository');
    const repo = new SupabaseJobRepository(mockSupabase as never);

    await expect(repo.createJob(samplePayload)).rejects.toThrow(
      'Supabase createJob fehlgeschlagen: Connection Timeout'
    );
  });

  it('fails fast and throws when Supabase query encounters an error in getJobById', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'Table locked' } }),
          }),
        }),
      }),
    };

    const { SupabaseJobRepository } = await import('./job-repository');
    const repo = new SupabaseJobRepository(mockSupabase as never);

    await expect(repo.getJobById('job-123')).rejects.toThrow(
      /Supabase getJobById (fehlgeschlagen|error): Table locked/
    );
  });

  it('cascades deletion to Supabase Object Storage when job contains files with storagePath', async () => {
    const mockRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockStorage = {
      from: vi.fn().mockReturnValue({
        remove: mockRemove,
      }),
    };

    const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      storage: mockStorage,
      from: vi.fn((table: string) => {
        if (table === DB_TABLES.DOSSIER_JOBS) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'job-123',
                      organization_id: 'org-1',
                      status: JOB_STATUS.COMPLETED,
                      payload: {
                        files: [
                          { name: 'doc1.pdf', storagePath: 'org-1/file-1.pdf' },
                          { name: 'doc2.pdf', storagePath: 'org-1/file-2.pdf' },
                        ],
                      },
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'job-123',
                    organization_id: 'org-1',
                    status: JOB_STATUS.COMPLETED,
                    payload: {
                      files: [
                        { name: 'doc1.pdf', storagePath: 'org-1/file-1.pdf' },
                        { name: 'doc2.pdf', storagePath: 'org-1/file-2.pdf' },
                      ],
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: mockDeleteEq,
              }),
            }),
          };
        }
        return {};
      }),
    };

    const { SupabaseJobRepository } = await import('./job-repository');
    const repo = new SupabaseJobRepository(mockSupabase as never);

    const success = await repo.deleteJob('job-123', 'org-1');

    expect(success).toBe(true);
    expect(mockStorage.from).toHaveBeenCalledWith(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
    expect(mockRemove).toHaveBeenCalledWith(['org-1/file-1.pdf', 'org-1/file-2.pdf']);
    expect(mockDeleteEq).toHaveBeenCalled();
  });

  it('schreibt null für lockedAt und errorMessage, lässt undefined-Felder aber weg', async () => {
    const update = vi.fn();
    const chain = {
      update: (data: unknown) => {
        update(data);
        return chain;
      },
      eq: () => chain,
      in: () => chain,
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const mockSupabase = { from: vi.fn().mockReturnValue(chain) };

    const { SupabaseJobRepository } = await import('./job-repository');
    const repo = new SupabaseJobRepository(mockSupabase as never);
    await repo.transitionJob('job-1', [JOB_STATUS.PROCESSING], {
      status: JOB_STATUS.CANCELLED,
      lockedAt: null,
      errorMessage: null,
      resultDossierId: undefined,
    });

    const written = update.mock.calls[0]?.[0];
    expect(written).toMatchObject({ locked_at: null, error_message: null });
    expect(written).not.toHaveProperty('result_dossier_id');
  });

  it('fails fast and throws when Supabase delete encounters an error in deleteJob', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Foreign key violation' } }),
        }),
      }),
    };

    const { SupabaseJobRepository } = await import('./job-repository');
    const repo = new SupabaseJobRepository(mockSupabase as never);

    await expect(repo.deleteJob('job-err')).rejects.toThrow(
      'Supabase deleteJob fehlgeschlagen: Foreign key violation'
    );
  });

  it('wirft bei Fehler im Speicher und löscht die Zeile nicht (keine verwaisten Dateien)', async () => {
    const del = vi.fn();
    const mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          remove: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'Bucket nicht erreichbar' } }),
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'job-1',
                organization_id: 'org',
                payload: { files: [{ name: 'a.pdf', storagePath: 'org/a.pdf' }] },
                created_at: 'x',
                updated_at: 'x',
              },
              error: null,
            }),
          }),
        }),
        delete: del,
      }),
    };

    const { SupabaseJobRepository } = await import('./job-repository');
    const repo = new SupabaseJobRepository(mockSupabase as never);

    await expect(repo.deleteJob('job-1')).rejects.toThrow('Bucket nicht erreichbar');
    expect(del).not.toHaveBeenCalled();
  });
  it('deleteJob entfernt fremde Pfade nicht aus dem Speicher', async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const row = {
      id: 'job-1',
      organization_id: 'org',
      payload: { files: [{ name: 'a', storagePath: 'fremd/a.pdf' }] },
      created_at: 'x',
      updated_at: 'x',
    };
    const mockSupabase = {
      storage: { from: vi.fn().mockReturnValue({ remove }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    };
    const { SupabaseJobRepository } = await import('./job-repository');
    await new SupabaseJobRepository(mockSupabase as never).deleteJob('job-1');
    expect(remove).not.toHaveBeenCalled();
  });

  describe('pruneCompletedJobs', () => {
    function setup(candidates: unknown[], removeImpl: (paths: string[]) => unknown) {
      const limit = vi.fn().mockResolvedValue({ data: candidates, error: null });
      const deleteSelect = vi
        .fn()
        .mockImplementation(() => Promise.resolve({ data: [], error: null }));
      const deleteIn = vi
        .fn()
        .mockReturnValue({ or: vi.fn().mockReturnValue({ select: deleteSelect }) });
      deleteSelect.mockImplementation(() =>
        Promise.resolve({
          data: deleteIn.mock.calls[0]?.[1]?.map((id: string) => ({ id })),
          error: null,
        })
      );
      const supabase = {
        storage: {
          from: vi.fn().mockReturnValue({ remove: vi.fn(async (p: string[]) => removeImpl(p)) }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit }) }),
            }),
          }),
          delete: vi.fn().mockReturnValue({ in: deleteIn }),
        }),
      };
      return { supabase, limit, deleteIn };
    }

    it('löscht Jobs mit Speicherfehler nicht, verarbeitet die übrigen weiter', async () => {
      const { supabase, deleteIn } = setup(
        [
          { id: 'ok', organization_id: 'org', files: [{ storagePath: 'org/ok.pdf' }] },
          { id: 'kaputt', organization_id: 'org', files: [{ storagePath: 'org/kaputt.pdf' }] },
        ],
        (paths) =>
          paths[0] === 'org/kaputt.pdf'
            ? { data: null, error: { message: 'Bucket nicht erreichbar' } }
            : { data: [], error: null }
      );
      const { SupabaseJobRepository } = await import('./job-repository');
      const repo = new SupabaseJobRepository(supabase as never);

      await expect(repo.pruneCompletedJobs()).resolves.toBe(1);
      expect(deleteIn).toHaveBeenCalledWith('id', ['ok']);
      expect(logFailure).toHaveBeenCalledWith('warn', expect.any(String), expect.any(Error));
    });

    it('entfernt nur eigene Upload-Pfade; fremde und Archivpfade bleiben, der Job wird trotzdem bereinigt', async () => {
      const { supabase, deleteIn } = setup(
        [
          {
            id: 'job',
            organization_id: 'org',
            files: [
              { storagePath: 'org/eigen.pdf' },
              { storagePath: 'fremd/x.pdf' },
              { storagePath: 'org/archive/akte/snapshot-1.json' },
              { storagePath: 'org/../fremd/x.pdf' },
            ],
          },
        ],
        () => ({ data: [], error: null })
      );
      const remove = vi.fn(async () => ({ data: [], error: null }));
      supabase.storage.from.mockReturnValue({ remove });
      const { SupabaseJobRepository } = await import('./job-repository');

      await expect(new SupabaseJobRepository(supabase as never).pruneCompletedJobs()).resolves.toBe(
        1
      );
      expect(remove).toHaveBeenCalledWith(['org/eigen.pdf']);
      expect(deleteIn).toHaveBeenCalledWith('id', ['job']);
      expect(logFailure).toHaveBeenCalledWith(
        'warn',
        'job_fremde_pfade_uebersprungen',
        expect.any(Error)
      );
    });

    it('ohne Kanzlei am Job wird nichts aus dem Speicher entfernt', async () => {
      const { supabase } = setup(
        [{ id: 'job', organization_id: null, files: [{ storagePath: 'org/x.pdf' }] }],
        () => ({ data: [], error: null })
      );
      const remove = vi.fn(async () => ({ data: [], error: null }));
      supabase.storage.from.mockReturnValue({ remove });
      const { SupabaseJobRepository } = await import('./job-repository');
      await new SupabaseJobRepository(supabase as never).pruneCompletedJobs();
      expect(remove).not.toHaveBeenCalled();
    });

    it('fragt höchstens JOB_PRUNE_BATCH Kandidaten ab', async () => {
      const { supabase, limit } = setup([], () => ({ error: null }));
      const { SupabaseJobRepository, JOB_PRUNE_BATCH } = await import('./job-repository');
      await new SupabaseJobRepository(supabase as never).pruneCompletedJobs();
      expect(limit).toHaveBeenCalledWith(JOB_PRUNE_BATCH);
    });
  });
});
