import { describe, expect, it } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import {
  HybridSearchResult,
  KNOWLEDGE_CATEGORIES,
  KnowledgeDocument,
  MATCH_SOURCES,
} from '@/types/knowledge';
import { formatKnowledgeForPrompt, selectApplicableKnowledge } from './rule-selector';

const doc = (overrides: Partial<KnowledgeDocument>): KnowledgeDocument => ({
  id: 'd0000000-0000-4000-8000-000000000001',
  organizationId: null,
  category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
  legalBasis: '§ 1 TEST',
  title: 'Titel',
  content: 'Inhalt',
  triggerKeywords: [],
  isGlobal: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const hit = (overrides: Partial<KnowledgeDocument>): HybridSearchResult => ({
  document: doc(overrides),
  textScore: 1,
  vectorScore: 0,
  combinedScore: 1,
  matchSource: MATCH_SOURCES.HYBRID_FUSION,
  textRank: null,
  vectorRank: null,
  rrfScore: 1,
});

const matches = (keyword: string, context: Parameters<typeof selectApplicableKnowledge>[1]) =>
  selectApplicableKnowledge([doc({ triggerKeywords: [keyword] })], context).length === 1;

const base = { caseType: CASE_TYPES.IMMOBILIENKAUF };

describe('selectApplicableKnowledge: Quellen des Suchtexts', () => {
  it('findet Stichwörter in Notizen, Feldern, Dateinamen und Dokumenttypen', () => {
    expect(matches('abcdefg', { ...base, notes: 'Hinweis ABCDEFG offen' })).toBe(true);
    expect(matches('abcdefg', { ...base, fields: { x: 'ABCDEFG' } })).toBe(true);
    expect(matches('abcdefg', { ...base, detectedDocuments: [{ fileName: 'ABCDEFG.pdf' }] })).toBe(
      true
    );
    expect(matches('abcdefg', { ...base, detectedDocuments: [{ documentType: 'abcdefg' }] })).toBe(
      true
    );
  });
  it('findet nichts ohne die Quelle und trennt Quellen durch Leerzeichen', () => {
    expect(matches('abcdefg', base)).toBe(false);
    expect(matches('abcdefg', { ...base, notes: 'abcdef', fields: { x: 'g' } })).toBe(false);
    expect(matches('abc', { ...base, notes: 'zab', detectedDocuments: [{ fileName: 'c' }] })).toBe(
      false
    );
  });
  it('liefert bei fehlendem Kontext keine Treffer außer globalen Regeln', () => {
    const global = doc({ id: 'd0000000-0000-4000-8000-000000000002', isGlobal: true });
    const kept = selectApplicableKnowledge([doc({ triggerKeywords: [] }), global], base);
    expect(kept).toEqual([global]);
  });
});

describe('selectApplicableKnowledge: kurze Kürzel mit Wortgrenze', () => {
  it('trifft ein Kürzel nur als eigenes Wort', () => {
    expect(matches('ug', { ...base, notes: 'ug' })).toBe(true);
    expect(matches('ug', { ...base, notes: 'ug vertrag' })).toBe(true);
    expect(matches('ug', { ...base, notes: 'vertrag ug' })).toBe(true);
    expect(matches('ug', { ...base, notes: 'die (ug) haftet' })).toBe(true);
  });
  it('trifft ein Kürzel nicht innerhalb eines Wortes, weder davor noch dahinter', () => {
    expect(matches('ug', { ...base, notes: 'zugang' })).toBe(false);
    expect(matches('ug', { ...base, notes: 'ugly' })).toBe(false);
    expect(matches('ug', { ...base, notes: 'zug' })).toBe(false);
    expect(matches('ug', { ...base, notes: '1ug' })).toBe(false);
  });
  it('sucht weiter, wenn der erste Treffer mitten im Wort liegt', () => {
    expect(matches('ug', { ...base, notes: 'zug ug' })).toBe(true);
    expect(matches('ug', { ...base, notes: 'ugly und zug' })).toBe(false);
  });
  it('gilt bis vier Zeichen als Kürzel, ab fünf als Teilstring', () => {
    expect(matches('gmbh', { ...base, notes: 'xgmbhx' })).toBe(false);
    expect(matches('gmbh', { ...base, notes: 'x gmbh x' })).toBe(true);
    expect(matches('gmbhx', { ...base, notes: 'xgmbhxx' })).toBe(true);
  });
  it('ignoriert Groß- und Kleinschreibung des Stichworts', () => {
    expect(matches('GmbH', { ...base, notes: 'die gmbh' })).toBe(true);
  });
});

describe('selectApplicableKnowledge: Auswahl der Dokumente', () => {
  it('nimmt globale Regeln ohne Stichwort auf und lässt stichwortlose Regeln aus', () => {
    const global = doc({ id: 'd0000000-0000-4000-8000-000000000002', isGlobal: true });
    const local = doc({ id: 'd0000000-0000-4000-8000-000000000003' });
    expect(selectApplicableKnowledge([global, local], base)).toEqual([global]);
  });
  it('lässt Dokumente ohne Treffer aus und behält die Reihenfolge der Treffer', () => {
    const a = doc({ id: 'd0000000-0000-4000-8000-00000000000a', triggerKeywords: ['abcdefg'] });
    const b = doc({ id: 'd0000000-0000-4000-8000-00000000000b', triggerKeywords: ['zzzzzzz'] });
    const c = doc({ id: 'd0000000-0000-4000-8000-00000000000c', triggerKeywords: ['abcdefg'] });
    expect(selectApplicableKnowledge([a, b, c], { ...base, notes: 'abcdefg' })).toEqual([a, c]);
  });
});

describe('formatKnowledgeForPrompt: Aufbau', () => {
  const rule = (n: number, extra: Partial<KnowledgeDocument> = {}) =>
    doc({
      id: `d0000000-0000-4000-8000-00000000000${n}`,
      legalBasis: `§ ${n} X`,
      title: `Titel ${n}`,
      content: `Inhalt ${n}`,
      ...extra,
    });

  it('gibt ohne Regeln und ohne Treffer einen leeren Text zurück', () => {
    expect(formatKnowledgeForPrompt([], [])).toBe('');
    expect(formatKnowledgeForPrompt([])).toBe('');
  });
  it('nummeriert Regeln ab 1 und hängt die Maßnahme nur bei vorhandenem Hinweis an', () => {
    const text = formatKnowledgeForPrompt([rule(1, { suggestedAction: 'Nachfordern.' }), rule(2)]);
    expect(text).toBe(
      '=== GESETZLICHE PRÜFUNGSMASSSTÄBE ===\n' +
        '1. [§ 1 X] Titel 1:\n   - Prüfvorgabe: Inhalt 1\n   - Bei Mangel/Lücke: Nachfordern.\n\n' +
        '2. [§ 2 X] Titel 2:\n   - Prüfvorgabe: Inhalt 2\n'
    );
  });
  it('lässt Treffer aus, die schon als Regel enthalten sind, und nummeriert den Rest ab 1', () => {
    const text = formatKnowledgeForPrompt(
      [rule(1)],
      [
        hit({ id: rule(1).id, title: 'Doppelt' }),
        hit({ id: rule(3).id, legalBasis: '§ 3 X', title: 'Neu', content: 'Inhalt 3' }),
        hit({
          id: rule(4).id,
          legalBasis: '§ 4 X',
          courtOrAuthority: 'AG Hamburg',
          title: 'Mit Gericht',
          content: 'Inhalt 4',
        }),
      ]
    );
    expect(text).not.toContain('Doppelt');
    expect(text).toContain(
      '=== EINSCHLÄGIGE DNOTI-GUTACHTEN & AMTSGERICHTS-PRAXIS ===\n' +
        '1. [§ 3 X] Neu:\n   - Rechtliche Vorgabe: Inhalt 3\n\n' +
        '2. [§ 4 X — AG Hamburg] Mit Gericht:\n   - Rechtliche Vorgabe: Inhalt 4\n'
    );
  });
  it('trennt beide Abschnitte durch eine Leerzeile und lässt den Abschnitt ohne neue Treffer weg', () => {
    const both = formatKnowledgeForPrompt([rule(1)], [hit({ id: rule(3).id })]);
    expect(both).toContain('Inhalt 1\n\n=== EINSCHLÄGIGE');
    const onlyDuplicates = formatKnowledgeForPrompt([rule(1)], [hit({ id: rule(1).id })]);
    expect(onlyDuplicates).not.toContain('EINSCHLÄGIGE');
  });
  it('gibt nur den Abschnitt der Treffer aus, wenn keine Regeln gewählt sind', () => {
    const text = formatKnowledgeForPrompt([], [hit({ id: rule(3).id, title: 'Neu' })]);
    expect(text.startsWith('=== EINSCHLÄGIGE')).toBe(true);
    expect(text).not.toContain('GESETZLICHE');
    expect(text.endsWith('\n')).toBe(true);
  });
});
