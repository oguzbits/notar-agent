import { describe, it, expect } from 'vitest';
import { FIELD_STATUS } from '@/types/dossier';
import { STATUS_LABELS_DE } from './constants';
import { localizeStatusWords } from './status-wording';

describe('localizeStatusWords', () => {
  it('ersetzt jeden exakten Statuswert durch den Anzeigebegriff', () => {
    const text = Object.values(FIELD_STATUS).join(' / ');
    const expected = Object.values(FIELD_STATUS)
      .map((status) => STATUS_LABELS_DE[status])
      .join(' / ');
    expect(localizeStatusWords(text)).toBe(expected);
  });

  it('ersetzt mehrfache Vorkommen in einem Satz', () => {
    expect(localizeStatusWords('Der Kaufpreis ist NEEDS_REVIEW (zuvor VERIFIED).')).toBe(
      `Der Kaufpreis ist ${STATUS_LABELS_DE.NEEDS_REVIEW} (zuvor ${STATUS_LABELS_DE.VERIFIED}).`
    );
  });

  it('lässt Wortteile, Kleinschreibung und andere Bezeichner unverändert', () => {
    const text = 'MISSING_DATA, NOT_MISSING, missing, Missing, ACTION_REQUIRED, UNVERIFIED';
    expect(localizeStatusWords(text)).toBe(text);
  });
});
