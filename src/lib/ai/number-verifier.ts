/**
 * Zahlenerkennung mit Unterstützung für deutsche Tausendertrennzeichen (Leerzeichen, Punkt, geschützte Leerzeichen)
 * sowie Dezimalkomma und Dezimalpunkt.
 */
const NUMBER_PATTERN = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)*/g;
const DATE_PATTERN = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;

export const numbersOf = (text: string): string[] => {
  const result: string[] = [];
  const matches = text.match(NUMBER_PATTERN) ?? [];
  for (const m of matches) {
    const digits = m.replace(/[^\d]/g, '');
    if (digits) result.push(digits);
  }

  // Zusätzliche Zerlegung deutscher Datumsangaben (z. B. 10.02.2023 -> 10, 02, 2023),
  // damit ISO-Daten (2023-02-10) oder Einzeljahre matchen
  let dateMatch: RegExpExecArray | null;
  while ((dateMatch = DATE_PATTERN.exec(text)) !== null) {
    if (dateMatch[1]) result.push(dateMatch[1]);
    if (dateMatch[2]) result.push(dateMatch[2]);
    if (dateMatch[3]) result.push(dateMatch[3]);
  }

  return [...new Set(result)];
};

const MIN_ROUNDED_DIGITS = 2;
const MAX_ROUNDED_SOURCE_DIGITS = 15;
const ROUND_UP_FROM = 5;

function roundedTo(digits: string, count: number): string {
  const head = Number(digits.slice(0, count));
  const up = Number(digits[count]) >= ROUND_UP_FROM ? 1 : 0;
  return String(head + up).replace(/0+$/, '');
}

const withoutTrailingZeros = (digits: string): string => digits.replace(/0+$/, '');

function isOtherUnitOf(figure: string, evidence: string): boolean {
  const significant = withoutTrailingZeros(figure);
  const count = significant.length;
  if (count < MIN_ROUNDED_DIGITS) return false;
  return (
    withoutTrailingZeros(evidence) === significant ||
    (evidence.length > count &&
      evidence.length <= MAX_ROUNDED_SOURCE_DIGITS &&
      roundedTo(evidence, count) === significant)
  );
}

/**
 * Ermittelt alle Ziffernfolgen einer Aussage oder eines Feldes, die in den Belegen nicht vorkommen.
 * Berücksichtigt Einheiten-Umwandlungen (z. B. Tsd. zu voll ausgeschriebener Zahl) und Rundungen.
 */
export function findUnsupportedNumbers(statement: string, evidence: string): string[] {
  const supported = numbersOf(evidence);
  return numbersOf(statement).filter(
    (number) => !supported.some((said) => said === number || isOtherUnitOf(number, said))
  );
}

export function extractDomainTextFromData(data: unknown): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number') return String(data);
  if (Array.isArray(data)) return data.map(extractDomainTextFromData).join(' ');
  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .filter(
        ([k]) =>
          !['pageNumber', 'sequenceNumber', 'page', 'id', 'status', 'sharePercent'].includes(k)
      )
      .map(([, v]) => extractDomainTextFromData(v))
      .join(' ');
  }
  return '';
}
