import { jsonrepair } from 'jsonrepair';

/**
 * Entfernt Modell-interne Denkprozess-Tags (<thought>...</thought>, <thinking>...</thinking>)
 * vor dem Extrahieren von JSON-Blöcken.
 */
export function stripThoughtBlocks(text: string): string {
  if (!text) return '';
  return (
    text
      .replace(/<\s*(?:thought|thinking)\b[^>]*>[\s\S]*?<\s*\/\s*(?:thought|thinking)\s*>/gi, '')
      // Falls das Modell einen unvollständigen/abgeschnittenen Thought-Block am Anfang hinterlassen hat
      .replace(/^<\s*(?:thought|thinking)\b[^>]*>[\s\S]*?(?:(?=```)|(?=\{))/i, '')
      .trim()
  );
}

/**
 * Bereinigt rekursiv versehentlich in Freitextfeldern geleakte Thought-Tags.
 */
function sanitizeParsedValues(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/<\s*(?:thought|thinking)\b[^>]*>[\s\S]*?<\s*\/\s*(?:thought|thinking)\s*>/gi, '')
      .replace(/<\s*\/?\s*(?:thought|thinking)\b[^>]*>/gi, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeParsedValues(item));
  }
  if (value !== null && typeof value === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitizedObj[k] = sanitizeParsedValues(v);
    }
    return sanitizedObj;
  }
  return value;
}

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

  // 1. Denkprozess-Tags vor dem Parsen entfernen
  cleaned = stripThoughtBlocks(cleaned);

  // 2. Markdown Code-Fences entfernen
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

  // 3. Extrahiere äußersten JSON-Block falls Freitext voransteht oder nachfolgt
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
  }

  // 4. Direkter Parsing-Versuch
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('JSON muss ein Objekt oder Array sein.');
    }
    return sanitizeParsedValues(parsed) as T;
  } catch (_initialParseError: unknown) {
    // 5. Robuste Reparatur via jsonrepair bei fehlerhaften LLM-Antworten
    try {
      const repaired = jsonrepair(cleaned);
      const parsedRepaired = JSON.parse(repaired);
      if (typeof parsedRepaired !== 'object' || parsedRepaired === null) {
        throw new Error('JSON muss ein Objekt oder Array sein.');
      }
      return sanitizeParsedValues(parsedRepaired) as T;
    } catch (repairErr) {
      const msg = repairErr instanceof Error ? repairErr.message : 'Syntaxfehler';
      throw new Error(`Ungültiges JSON: ${msg}`);
    }
  }
}
