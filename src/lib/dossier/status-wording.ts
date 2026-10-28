import { FieldStatusSchema } from '@/types/dossier';
import { STATUS_LABELS_DE } from './constants';

// `_` zählt als Wortzeichen: `MISSING_DATA` bleibt unberührt, nur das exakte Statuswort wird ersetzt.
const STATUS_WORD_PATTERN = new RegExp(`\\b(${FieldStatusSchema.options.join('|')})\\b`, 'g');

/** Ersetzt technische Statusnamen in Freitexten des Modells durch die Anzeigebegriffe. */
export function localizeStatusWords(text: string): string {
  return text.replace(STATUS_WORD_PATTERN, (word) => {
    const status = FieldStatusSchema.parse(word);
    return STATUS_LABELS_DE[status];
  });
}
