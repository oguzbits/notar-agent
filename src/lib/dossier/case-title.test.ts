import { describe, it, expect } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { formatCaseTitle, getCaseParties } from './case-title';
import { CASE_TITLE_FALLBACK_DE } from './constants';
import { createEmptyImmobilienDossier } from './defaults';

describe('formatCaseTitle', () => {
  it('nennt Vorgangsart und Beteiligte statt Enum und Kurz-ID', () => {
    const title = formatCaseTitle({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      parties: ['Schmidt', 'Müller'],
      date: '2026-10-28T09:00:00Z',
    });
    expect(title).toBe('Immobilienkauf – Schmidt ./. Müller');
  });

  it('nutzt das Anlagedatum, wenn keine Beteiligten vorliegen', () => {
    const title = formatCaseTitle({
      caseType: CASE_TYPES.GMBH_GRUENDUNG,
      parties: ['', '  '],
      date: '2026-10-28T09:00:00Z',
    });
    expect(title).toBe('GmbH-Gründung vom 28.10.2026');
  });

  it('fällt ohne Beteiligte und Datum auf die Vorgangsart zurück', () => {
    expect(formatCaseTitle({ caseType: CASE_TYPES.IMMOBILIENKAUF, parties: [] })).toBe(
      'Immobilienkauf'
    );
  });

  it('zeigt für unbekannte Vorgangsart die neutrale Bezeichnung', () => {
    expect(formatCaseTitle({ caseType: 'ANDERE_ART', parties: [] })).toBe(CASE_TITLE_FALLBACK_DE);
    expect(formatCaseTitle({ parties: [] })).toBe(CASE_TITLE_FALLBACK_DE);
  });

  it('enthält nie den technischen Enum-Wert oder eine Kurz-ID', () => {
    const title = formatCaseTitle({ caseType: CASE_TYPES.IMMOBILIENKAUF, parties: [] });
    expect(title).not.toMatch(/IMMOBILIENKAUF|[0-9a-f]{8}/);
  });
});

describe('getCaseParties', () => {
  it('liefert Verkäufer und Käufer beim Immobilienkauf', () => {
    const dossier = createEmptyImmobilienDossier();
    dossier.fields.verkaeufer.data.name = 'Schmidt';
    dossier.fields.kaeufer.data.companyName = 'Müller';
    expect(getCaseParties(dossier)).toEqual(['Schmidt', 'Müller']);
  });
});
