import { describe, it, expect, vi } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { CASE_TYPES } from '@/types/dossier';
import { CreateJobPayload, JOB_STATUS } from '@/types/jobs';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';

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
});
