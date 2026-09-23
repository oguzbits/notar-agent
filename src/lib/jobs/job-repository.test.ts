import { describe, it, expect, vi } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { CreateJobPayload } from '@/types/jobs';

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
      'Supabase getJobById fehlgeschlagen: Table locked'
    );
  });
});
