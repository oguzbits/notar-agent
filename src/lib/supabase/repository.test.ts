import { describe, it, expect, vi } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { Dossier, CASE_TYPES, OVERALL_STATUS } from '@/types/dossier';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';
import { createEmptyImmobilienFields } from './repository';

function createMockDossier(title: string): Dossier {
  return {
    caseType: CASE_TYPES.IMMOBILIENKAUF,
    caseTitle: title,
    analysisTimestamp: new Date().toISOString(),
    overallStatus: OVERALL_STATUS.READY,
    executiveSummary: 'Test Zusammenfassung',
    detectedDocuments: [],
    fields: createEmptyImmobilienFields(),
    inquiries: [],
  };
}

describe('SupabaseDossierRepository (Fail-Fast SSOT)', () => {
  it('fails fast and throws when Supabase insert encounters an error in save', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Down' } }),
          }),
        }),
      }),
    };

    const { SupabaseDossierRepository } = await import('./repository');
    const repo = new SupabaseDossierRepository(mockSupabase as never);

    await expect(repo.save(createMockDossier('Test'))).rejects.toThrow(
      'Supabase Dossier save fehlgeschlagen: DB Down'
    );
  });

  it('fails fast and throws when Supabase update encounters an error in update', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Row lock failed' } }),
        }),
      }),
    };

    const { SupabaseDossierRepository } = await import('./repository');
    const repo = new SupabaseDossierRepository(mockSupabase as never);

    await expect(repo.update('doc-1', createMockDossier('Test'))).rejects.toThrow(
      'Supabase Dossier update fehlgeschlagen: Row lock failed'
    );
  });

  it('cascades deletion to Supabase Object Storage and linked jobs on delete', async () => {
    const mockRemove = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockList = vi.fn().mockResolvedValue({
      data: [{ name: 'snapshot-123.json' }],
      error: null,
    });
    const mockStorage = {
      from: vi.fn().mockReturnValue({
        remove: mockRemove,
        list: mockList,
      }),
    };

    const mockDelDocEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelJobsEq = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      storage: mockStorage,
      from: vi.fn((table: string) => {
        if (table === DB_TABLES.DOSSIER_JOBS) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'job-abc',
                      payload: {
                        files: [{ name: 'scan.pdf', storagePath: 'org-123/scan-1.pdf' }],
                      },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: mockDelJobsEq,
              }),
            }),
          };
        }
        if (table === DB_TABLES.DOCUMENTS) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'doc-1',
                      content: {
                        caseType: CASE_TYPES.IMMOBILIENKAUF,
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: mockDelDocEq,
              }),
            }),
          };
        }
        return {};
      }),
    };

    const { SupabaseDossierRepository } = await import('./repository');
    const repo = new SupabaseDossierRepository(mockSupabase as never);

    const success = await repo.delete('doc-1', 'org-123');

    expect(success).toBe(true);
    expect(mockStorage.from).toHaveBeenCalledWith(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
    expect(mockRemove).toHaveBeenCalledWith(
      expect.arrayContaining(['org-123/scan-1.pdf', 'org-123/archive/doc-1/snapshot-123.json'])
    );
    expect(mockDelJobsEq).toHaveBeenCalled();
    expect(mockDelDocEq).toHaveBeenCalled();
  });

  it('fails fast and throws when Supabase delete encounters an error in delete', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === DB_TABLES.DOSSIER_JOBS) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === DB_TABLES.DOCUMENTS) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'FK violation' } }),
            }),
          };
        }
        return {};
      }),
    };

    const { SupabaseDossierRepository } = await import('./repository');
    const repo = new SupabaseDossierRepository(mockSupabase as never);

    await expect(repo.delete('doc-err')).rejects.toThrow(
      'Supabase Dossier delete fehlgeschlagen: FK violation'
    );
  });
});
