import { jsonrepair } from 'jsonrepair';

/**
 * Bereinigt Markdown-Codefences und parst JSON fehlertolerant.
 * Verwendet jsonrepair für robuste Reparatur typischer LLM-Syntaxfehler (Trailing Commas,
 * unbalancierte Klammern bei Token-Limits, unescaped Strings).
 */
export function cleanAndParseJson<T = Record<string, unknown>>(rawText: string): T {
  let cleaned = rawText.trim();
  if (!cleaned) {
    throw new Error('Ungültiges JSON: Text ist leer.');
  }

  // 1. Markdown Code-Fences entfernen
  if (cleaned.includes('```')) {
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleaned = match[1].trim();
    } else {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
    }
  }

  // 2. Extrahiere äußersten JSON-Block falls Freitext voransteht oder nachfolgt
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
  }

  // 3. Direkter Parsing-Versuch
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('JSON muss ein Objekt oder Array sein.');
    }
    return parsed as T;
  } catch (_initialParseError: unknown) {
    // 4. Robuste Reparatur via jsonrepair bei fehlerhaften LLM-Antworten
    try {
      const repaired = jsonrepair(cleaned);
      const parsedRepaired = JSON.parse(repaired);
      if (typeof parsedRepaired !== 'object' || parsedRepaired === null) {
        throw new Error('JSON muss ein Objekt oder Array sein.');
      }
      return parsedRepaired as T;
    } catch (repairErr) {
      const msg = repairErr instanceof Error ? repairErr.message : 'Syntaxfehler';
      throw new Error(`Ungültiges JSON: ${msg}`);
    }
  }
}
