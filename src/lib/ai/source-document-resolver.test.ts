import { describe, it, expect } from 'vitest';
import { resolveSourceDocument, SourceDocumentText } from './source-document-resolver';

// Notiz hat docIndex 0, damit sie nie als Dokument 1 des Prompts aufgelöst wird
const SOURCES: SourceDocumentText[] = [
  { fileName: 'Bearbeitungsnotiz', docIndex: 0, textContent: 'Notiz' },
  { fileName: 'a.pdf', docIndex: 1, textContent: 'Text A' },
  { fileName: 'b.pdf', docIndex: 2, textContent: 'Text B' },
];

describe('resolveSourceDocument', () => {
  it('löst docIndex über die Prompt-Nummer auf, nicht über die Listenposition', () => {
    expect(resolveSourceDocument({ docIndex: 2 }, SOURCES)?.fileName).toBe('b.pdf');
  });

  it('löst Kurzschlüssel [DOC-n] über die Prompt-Nummer auf', () => {
    expect(resolveSourceDocument({ citationId: '[DOC-1]' }, SOURCES)?.fileName).toBe('a.pdf');
  });

  it('löst die Notiz nie über einen Dokumentschlüssel auf', () => {
    expect(resolveSourceDocument({ docIndex: 0 }, SOURCES)).toBeUndefined();
    expect(resolveSourceDocument({ citationId: 'doc_0' }, SOURCES)).toBeUndefined();
  });

  it('bleibt ohne docIndex-Angabe bei der Listenposition (Altverhalten)', () => {
    const legacy: SourceDocumentText[] = [
      { fileName: 'x.pdf', textContent: 'X' },
      { fileName: 'y.pdf', textContent: 'Y' },
    ];
    expect(resolveSourceDocument({ docIndex: 2 }, legacy)?.fileName).toBe('y.pdf');
  });

  it('findet weiterhin über den Dateinamen', () => {
    expect(resolveSourceDocument({ fileName: 'B.PDF' }, SOURCES)?.docIndex).toBe(2);
  });
});
