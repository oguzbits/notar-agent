/** Gemini Embedding 2 kennt keinen taskType; die Aufgabe steht stattdessen als Präfix im Text. */
function requireText(label: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new Error(`Einbettung braucht einen nicht leeren ${label}.`);
  return trimmed;
}

export const formatQueryForEmbedding = (text: string) =>
  `task: search result | query: ${requireText('Anfragetext', text)}`;

export const formatDocumentForEmbedding = (doc: { title: string; content: string }) =>
  `title: ${requireText('Titel', doc.title)} | text: ${requireText('Inhalt', doc.content)}`;
