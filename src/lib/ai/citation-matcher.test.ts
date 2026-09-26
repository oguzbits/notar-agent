import { describe, it, expect } from 'vitest';
import { CITATION_MATCH_STATUS } from '@/types/pipeline';
import { matchCitationSnippet } from './citation-matcher';

describe('matchCitationSnippet', () => {
  const sampleDocument = `
NOTARIELLE URKUNDE
Der Notar hat am 15. März 2026 beurkundet:
Der Gesamtkaufpreis beträgt 450.000,00 Euro (in Worten: vierhundertfünfzigtausend Euro).
Er ist auf das Notaranderkonto mit der IBAN DE12 3456 7890 1234 5678 90 zu zahlen.
Das Flurstück 108/4 in der Gemarkung Charlottenburg ist belastungsfrei zu übergeben.
Die Übergabe des Kaufgegenstandes erfolgt zum 1. Mai 2026.
`;

  it('erkennt exakte Zitate mit Status EXACT und Konfidenz 1.0', () => {
    const snippet = 'Der Gesamtkaufpreis beträgt 450.000,00 Euro';
    const result = matchCitationSnippet(sampleDocument, snippet);

    expect(result.status).toBe(CITATION_MATCH_STATUS.EXACT);
    expect(result.confidence).toBe(1.0);
    expect(result.matchedSnippet).toBe(snippet);
    expect(result.startOffset).toBeGreaterThan(0);
  });

  it('erkennt Zitate mit abweichenden Zeilenumbrüchen und Leerräumen als FUZZY_MATCH', () => {
    const docWithBreak = `
Der Kaufgegenstand umfasst das Flurstück
108/4 in der Gemarkung Charlottenburg.
`;
    const snippet = 'Flurstück 108/4 in der Gemarkung Charlottenburg';
    const result = matchCitationSnippet(docWithBreak, snippet);

    expect(result.status).toBe(CITATION_MATCH_STATUS.FUZZY_MATCH);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.matchedSnippet).toContain('108/4');
  });

  it('toleriert OCR-Silbentrennung am Zeilenende (Hyphenation)', () => {
    const docWithHyphen = `
Der vereinbarte Ge-
samtkaufpreis beträgt 450.000 Euro.
`;
    const snippet = 'Gesamtkaufpreis beträgt 450.000 Euro';
    const result = matchCitationSnippet(docWithHyphen, snippet);

    expect(result.status).toBe(CITATION_MATCH_STATUS.FUZZY_MATCH);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('straft erfundene Halluzinationen mit NOT_FOUND und Konfidenz 0 ab', () => {
    const hallucinatedSnippet = 'Der Kaufpreis von 999.000 Euro ist sofort bar fällig.';
    const result = matchCitationSnippet(sampleDocument, hallucinatedSnippet);

    expect(result.status).toBe(CITATION_MATCH_STATUS.NOT_FOUND);
    expect(result.confidence).toBe(0);
    expect(result.matchedSnippet).toBeUndefined();
  });

  it('behandelt leere Snippets oder leere Quelltexte defensiv ohne Fehler', () => {
    expect(matchCitationSnippet('', 'Test').status).toBe(CITATION_MATCH_STATUS.NOT_FOUND);
    expect(matchCitationSnippet(sampleDocument, '').status).toBe(CITATION_MATCH_STATUS.NOT_FOUND);
    expect(matchCitationSnippet('', '').status).toBe(CITATION_MATCH_STATUS.NOT_FOUND);
  });
});
