import { describe, it, expect, vi } from 'vitest';
import { Dossier, CASE_TYPES, OVERALL_STATUS } from '@/types/dossier';
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
});
