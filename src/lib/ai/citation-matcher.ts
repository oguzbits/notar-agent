import { diffLevenshtein, diffMain, matchMain } from 'diff-match-patch-es';
import { CITATION_MATCH_STATUS, CitationMatchResult } from '@/types/pipeline';

export interface CitationMatchOptions {
  /**
   * Erlaubte Fehlertoleranz bei Bitap Fuzzy Match (0.0 = exakt, 1.0 = extrem tolerant).
   * Standard: 0.35 für hohe Präzision bei gleichzeitiger Fehlertoleranz für Umbrüche.
   */
  matchThreshold?: number;
  /**
   * Distanz in Zeichen, ab welcher Treffer bestraft werden.
   */
  matchDistance?: number;
}

/**
 * Normalisiert weiche Zeilenumbrüche und OCR-Hyphenation (z. B. "Kauf-\npreis" -> "Kaufpreis").
 */
function normalizeHyphenation(text: string): string {
  return text.replace(/(\w+)-\s*[\r\n]+\s*(\w+)/g, '$1$2');
}

/**
 * Deterministisches Zitat-Grounding via diff-match-patch (B.8.2).
 * Verifiziert, ob und wo ein extrahiertes Snippet im Quelltext existiert.
 */
export function matchCitationSnippet(
  sourceText: string,
  snippet: string,
  options: CitationMatchOptions = {}
): CitationMatchResult {
  const cleanSnippet = snippet?.trim() || '';
  const cleanSource = sourceText || '';

  if (!cleanSnippet || !cleanSource) {
    return {
      status: CITATION_MATCH_STATUS.NOT_FOUND,
      confidence: 0,
    };
  }

  // 1. Stufe: Exakter Substring-Check (O(N), 0 ms)
  const exactIndex = cleanSource.indexOf(cleanSnippet);
  if (exactIndex !== -1) {
    return {
      status: CITATION_MATCH_STATUS.EXACT,
      confidence: 1.0,
      matchedSnippet: cleanSnippet,
      startOffset: exactIndex,
      endOffset: exactIndex + cleanSnippet.length,
    };
  }

  // 2. Stufe: Normalisierter Check (Leerzeichen, Satzzeichen & Zeilenumbrüche)
  const normalizedSource = cleanSource.replace(/\s+/g, ' ');
  const normalizedSnippet = cleanSnippet.replace(/\s+/g, ' ');
  const normIndex = normalizedSource.indexOf(normalizedSnippet);
  if (normIndex !== -1) {
    return {
      status: CITATION_MATCH_STATUS.FUZZY_MATCH,
      confidence: 0.95,
      matchedSnippet: cleanSnippet,
      startOffset: normIndex,
      endOffset: normIndex + normalizedSnippet.length,
    };
  }

  // 3. Stufe: Hyphenation-Bereinigung ("-\n")
  const unhyphenatedSource = normalizeHyphenation(cleanSource);
  const unhyphenatedIndex = unhyphenatedSource.indexOf(cleanSnippet);
  if (unhyphenatedIndex !== -1) {
    return {
      status: CITATION_MATCH_STATUS.FUZZY_MATCH,
      confidence: 0.9,
      matchedSnippet: cleanSnippet,
      startOffset: unhyphenatedIndex,
      endOffset: unhyphenatedIndex + cleanSnippet.length,
    };
  }

  // 4. Stufe: Google diff-match-patch Bitap Algorithmus & Diff-Levenshtein
  const textToSearch = unhyphenatedSource.length > 0 ? unhyphenatedSource : cleanSource;
  const matchOptions = {
    matchThreshold: options.matchThreshold ?? 0.35,
    matchDistance: options.matchDistance ?? 1000,
  };

  function evaluateCandidate(matchIndex: number): CitationMatchResult | null {
    if (matchIndex === -1) return null;
    const candidateSnippet = textToSearch.slice(matchIndex, matchIndex + cleanSnippet.length);
    const diffs = diffMain(cleanSnippet, candidateSnippet);
    const levenshtein = diffLevenshtein(diffs);
    const confidence = Math.max(0, 1 - levenshtein / Math.max(cleanSnippet.length, 1));

    if (confidence >= 0.7) {
      return {
        status: CITATION_MATCH_STATUS.FUZZY_MATCH,
        confidence: Number(confidence.toFixed(2)),
        matchedSnippet: candidateSnippet,
        startOffset: matchIndex,
        endOffset: matchIndex + cleanSnippet.length,
      };
    }
    return null;
  }

  try {
    const searchPattern = cleanSnippet.length <= 32 ? cleanSnippet : cleanSnippet.slice(0, 30);
    const matchIndex = matchMain(textToSearch, searchPattern, 0, matchOptions);
    const result = evaluateCandidate(matchIndex);
    if (result) return result;
  } catch (err) {
    console.warn('[citation-matcher] Fehler bei diff-match-patch Bitap-Suche:', err);
  }

  // Nicht im Quelltext nachweisbar (potenzielle Halluzination)
  return {
    status: CITATION_MATCH_STATUS.NOT_FOUND,
    confidence: 0,
  };
}
