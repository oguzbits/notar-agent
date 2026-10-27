import { describe, expect, it } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { buildKnowledgeSearchText } from './search-text';

describe('buildKnowledgeSearchText', () => {
  it('verbindet Vorgangstyp, Notizen und Dateinamen mit Leerzeichen', () => {
    expect(buildKnowledgeSearchText(CASE_TYPES.IMMOBILIENKAUF, 'Notiz A', ['a.pdf', 'b.pdf'])).toBe(
      `${CASE_TYPES.IMMOBILIENKAUF} Notiz A a.pdf b.pdf`
    );
  });
  it('lässt leere Teile weg', () => {
    expect(buildKnowledgeSearchText(CASE_TYPES.GMBH_GRUENDUNG, '', [])).toBe(
      CASE_TYPES.GMBH_GRUENDUNG
    );
  });
});
