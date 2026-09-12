/**
 * Bereinigt Markdown-Codefences und parst JSON fehlertolerant.
 */
export function cleanAndParseJson<T = Record<string, unknown>>(rawText: string): T {
  let cleaned = rawText.trim();
  if (!cleaned) {
    throw new Error('Ungültiges JSON: Text ist leer.');
  }

  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Syntaxfehler';
    throw new Error(`Ungültiges JSON: ${msg}`);
  }
}
