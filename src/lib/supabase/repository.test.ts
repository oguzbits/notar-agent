import { describe, it, expect, beforeEach } from 'vitest';
import { Dossier, CASE_TYPES, OVERALL_STATUS, STORAGE_TYPES } from '@/types/dossier';
import { InMemoryDossierRepository, createEmptyImmobilienFields } from './repository';

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

describe('InMemoryDossierRepository', () => {
  let repo: InMemoryDossierRepository;

  beforeEach(() => {
    repo = new InMemoryDossierRepository(3); // Kleine Kapazität für FIFO-Test
  });

  it('speichert und findet Dokumente', async () => {
    const dossier = createMockDossier('Vorgang 1');
    const result = await repo.save(dossier);

    expect(result.persisted).toBe(true);
    expect(result.storageType).toBe(STORAGE_TYPES.IN_MEMORY);

    const found = await repo.findById(result.id);
    expect(found).not.toBeNull();
    expect(found?.title).toContain('Immobilienkauf');
  });

  it('aktualisiert bestehende Dokumente', async () => {
    const dossier = createMockDossier('Vorgang 1');
    const result = await repo.save(dossier);

    const updatedDossier = {
      ...dossier,
      executiveSummary: 'Aktualisierte Zusammenfassung',
    };
    const updateRes = await repo.update(result.id, updatedDossier);
    expect(updateRes.success).toBe(true);

    const found = await repo.findById(result.id);
    expect(found?.content.executiveSummary).toBe('Aktualisierte Zusammenfassung');
  });

  it('löscht Dokumente', async () => {
    const dossier = createMockDossier('Vorgang 1');
    const result = await repo.save(dossier);

    const deleteSuccess = await repo.delete(result.id);
    expect(deleteSuccess).toBe(true);

    const found = await repo.findById(result.id);
    expect(found).toBeNull();
  });

  it('begrenzt die Puffergröße (FIFO) um Memory-Leaks zu verhindern', async () => {
    const d1 = await repo.save(createMockDossier('V1'));
    const d2 = await repo.save(createMockDossier('V2'));
    const d3 = await repo.save(createMockDossier('V3'));

    let list = await repo.list();
    expect(list.length).toBe(3);

    // 4. Eintrag hinzugefügt -> ältestes Element (d1) muss verworfen werden
    const d4 = await repo.save(createMockDossier('V4'));
    list = await repo.list();
    expect(list.length).toBe(3);
    expect(list.map((d) => d.id)).not.toContain(d1.id);
    expect(list.map((d) => d.id)).toEqual([d4.id, d3.id, d2.id]);
  });
});
