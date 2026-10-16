import { describe, it, expect, vi } from 'vitest';
import { DELETION_REASONS } from '@/types/deletion';
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

  it('löscht über die Datenbankfunktion und liefert den validierten Nachweis', async () => {
    const receipt = { documentId: 'doc-1', deletedRows: { documents: 1 }, storageTasks: 2 };
    const rpc = vi.fn().mockResolvedValue({ data: receipt, error: null });

    const { SupabaseDossierRepository } = await import('./repository');
    const repo = new SupabaseDossierRepository({ rpc } as never);

    await expect(repo.delete('doc-1', DELETION_REASONS.ENTWURF_VERWORFEN)).resolves.toEqual(
      receipt
    );
    expect(rpc).toHaveBeenCalledWith('delete_dossier', {
      p_document_id: 'doc-1',
      p_reason: DELETION_REASONS.ENTWURF_VERWORFEN,
    });
  });

  it('wirft DossierNotFoundError, wenn die Datenbank das Dossier nicht findet', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0002', message: 'x' } });

    const { SupabaseDossierRepository, DossierNotFoundError } = await import('./repository');
    const repo = new SupabaseDossierRepository({ rpc } as never);

    await expect(repo.delete('doc-x', DELETION_REASONS.SONSTIGES)).rejects.toBeInstanceOf(
      DossierNotFoundError
    );
  });

  it('fails fast bei Datenbankfehlern und ungültigem Nachweis', async () => {
    const { SupabaseDossierRepository } = await import('./repository');

    const failing = new SupabaseDossierRepository({
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: '23503', message: 'FK violation' } }),
    } as never);
    await expect(failing.delete('doc-err', DELETION_REASONS.SONSTIGES)).rejects.toThrow(
      'Supabase Dossier delete fehlgeschlagen: FK violation'
    );

    const garbage = new SupabaseDossierRepository({
      rpc: vi.fn().mockResolvedValue({ data: { storageTasks: -1 }, error: null }),
    } as never);
    await expect(garbage.delete('doc-1', DELETION_REASONS.SONSTIGES)).rejects.toThrow();
  });
});
