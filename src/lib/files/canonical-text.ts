/**
 * Kanonische Text-Normalisierung für notarielle Akten und Ingestion.
 *
 * Garantiert:
 * 1. Mathematische Idempotenz: f(f(x)) === f(x)
 * 2. Bereinigung von Steuerzeichen (BOM, Null-Bytes, ASCII Control Chars) unter Bewahrung von Tabs und Newlines
 * 3. Einheitliche Unix-Zeilenumbrüche (\n) und Normalisierung von mehrfachen Leerzeilen
 * 4. Striktes Unicode NFC (Normal Form C) für stabile deutsche Umlaute (ä, ö, ü, ß)
 * 5. Reparatur defekter Markdown-Tabellen-Trennerzeilen für stabile Zitations-Offsets
 */

// Steuerzeichen außer Tab (\u0009) und Zeilenumbruch (\u000A), plus Byte Order Mark (\uFEFF)

const UNWANTED_CONTROL_CHARS = /[\u{0}-\u{8}\u{B}-\u{1F}\u{7F}\u{FEFF}]/gu;

const DELIMITER_ROW = /^\|(?:\s*:?-+:?\s*\|)+$/;
const CELL_SEPARATOR = /(?<!\\)\|/;
const DEFAULT_DELIMITER_CELL = ':---';

const cellsOf = (row: string): string[] =>
  row.trim().replace(/^\|/, '').replace(/\|$/, '').split(CELL_SEPARATOR);

/**
 * Stellt sicher, dass Markdown-Tabellen exakt so viele Trennerzellen wie Spaltenüberschriften besitzen.
 * Unvollständige Trennerzeilen aus OCR oder LLM-Transkriptionen werden deterministisch angepasst.
 */
function matchDelimiterToHeader(text: string): string {
  const lines = text.split('\n');
  for (let index = 1; index < lines.length; index += 1) {
    const header = (lines[index - 1] ?? '').trim();
    const delimiter = (lines[index] ?? '').trim();
    if (!header.startsWith('|') || !DELIMITER_ROW.test(delimiter)) continue;
    const count = cellsOf(header).length;
    const cells = cellsOf(delimiter);
    if (cells.length === count) continue;
    const matched = Array.from(
      { length: count },
      (_, cell) => cells[cell]?.trim() ?? DEFAULT_DELIMITER_CELL
    );
    lines[index] = `| ${matched.join(' | ')} |`;
  }
  return lines.join('\n');
}

/**
 * Führt Rohtexte in eine kanonische, deterministische Repräsentation über.
 * Völlig frei von I/O, pure Funktion, strikt idempotent.
 */
export function toCanonicalText(raw: string): string {
  if (!raw) return '';

  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(UNWANTED_CONTROL_CHARS, '')
    .normalize('NFC')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return matchDelimiterToHeader(text);
}
