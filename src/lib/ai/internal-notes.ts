import { NOTAR_DOCUMENT_TYPES } from '@/types/dossier';
import type { Dossier } from '@/types/dossier';

export function formatInternalNotes(
  notes: string,
  existingDossier?: Dossier
): { noteList: string[]; notesSection: string } {
  const noteList = notes
    .split('\n\n')
    .map((n) => n.trim())
    .filter(Boolean);

  if (noteList.length === 0) {
    return { noteList, notesSection: '' };
  }

  const existingNoteCount =
    existingDossier?.detectedDocuments?.filter((d) => d.fileName.toLowerCase().startsWith('notiz'))
      .length || 0;

  const formattedNotes = noteList
    .map((text, i) => `[Notiz #${existingNoteCount + i + 1}]: "${text}"`)
    .join('\n');

  const notesSection = `=== INTERNE NOTIZEN / BEARBEITUNGSVERMERKE DER SACHBEARBEITUNG ===
${formattedNotes}
(WICHTIGE ANWEISUNG FÜR QUELLEN UND DOKUMENTE:
- Belege aus diesen Notizen MÜSSEN als source.fileName prägnant den Bezeichner "Notiz #${existingNoteCount + 1}" (bzw. die entsprechende Nummer) erhalten.
- Jede dieser Notizen MUSS zwingend auch in 'detectedDocuments' als Typ "${NOTAR_DOCUMENT_TYPES.BEARBEITUNGSNOTIZ}" mit aktuellem Tagesdatum aufgeführt werden.
- Fasse diese Notizen NIEMALS zusammen oder kürze sie ab! Der Text muss exakt 1:1 im vollen Originalwortlaut wiedergegeben werden.)\n\n`;

  return { noteList, notesSection };
}
