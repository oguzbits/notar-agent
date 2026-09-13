import { parseISO, format, isValid } from 'date-fns';
import { de } from 'date-fns/locale';

export function formatDateGerman(dateStr?: string | null): string {
  if (!dateStr || dateStr.trim().length === 0) return '—';

  const trimmed = dateStr.trim();

  // Bereits im deutschen Format (z.B. 15.11.2011 oder 15.11.11)
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(trimmed)) {
    return trimmed;
  }

  // Parse ISO JJJJ-MM-TT oder volles Date
  const parsed = parseISO(trimmed);
  if (isValid(parsed)) {
    return format(parsed, 'dd.MM.yyyy', { locale: de });
  }

  const d = new Date(trimmed);
  if (isValid(d)) {
    return format(d, 'dd.MM.yyyy', { locale: de });
  }

  return trimmed;
}

export function formatDateTimeGerman(dateStr?: string | null): string {
  if (!dateStr || dateStr.trim().length === 0) return '—';

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  return dateStr;
}

/**
 * Formatiert Grundbucheigentümer-Einträge, falls sie als String oder als Objekt übergeben werden.
 */
export function formatOwnerEntry(owner: unknown): string {
  if (!owner) return '—';
  if (typeof owner === 'string') return owner;
  if (typeof owner === 'object') {
    const obj = owner as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name : '';
    const birthDate =
      typeof obj.birthDate === 'string' ? ` (geb. ${formatDateGerman(obj.birthDate)})` : '';
    const share =
      typeof obj.share === 'string' &&
      obj.share &&
      !obj.share.toLowerCase().includes('nicht spezifiziert')
        ? ` [${obj.share}]`
        : '';
    if (name) {
      return `${name}${birthDate}${share}`;
    }
    return JSON.stringify(owner);
  }
  return String(owner);
}

/**
 * Bereinigt unvollständige Werte oder Platzhalter (wie "UNKNOWN", "null", "undefined", "n/a") zu null/leer.
 */
export function cleanTextValue(val?: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (
    str.length === 0 ||
    /^(unknown|missing|null|undefined|n\/?a|none|unbekannt|nicht angegeben|nicht eingereicht|fehlt|\?|-|—)$/i.test(
      str.replace(/^[,\s;.-]+|[,\s;.-]+$/g, '')
    )
  ) {
    return null;
  }
  return str;
}
