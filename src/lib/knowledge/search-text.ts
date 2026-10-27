/** Suchtext der Wissenssuche: Vorgangstyp, Notizblock und erkannte Dateinamen, leere Teile entfallen. */
export function buildKnowledgeSearchText(
  caseType: string,
  notesSection: string,
  docNames: string[]
): string {
  return [caseType, notesSection, ...docNames].filter(Boolean).join(' ');
}
