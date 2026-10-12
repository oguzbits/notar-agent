import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { toCanonicalText } from './canonical-text';

describe('toCanonicalText', () => {
  it('unifies line endings to \\n', () => {
    expect(toCanonicalText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('removes control characters and the byte order mark but keeps tabs and newlines', () => {
    expect(toCanonicalText('\uFEFFa\u0000b\u0007c\td\ne')).toBe('abc\td\ne');
  });

  it('strips trailing spaces on every line', () => {
    expect(toCanonicalText('eins   \nzwei\t \ndrei')).toBe('eins\nzwei\ndrei');
  });

  it('collapses three or more line breaks to one blank line', () => {
    expect(toCanonicalText('a\n\n\n\nb\n\nc')).toBe('a\n\nb\n\nc');
  });

  it('trims the whole text', () => {
    expect(toCanonicalText('\n\n  Text \n\n')).toBe('Text');
  });

  it('normalizes to Unicode NFC so composed and decomposed umlauts are the same text', () => {
    // "München" with decomposed "u" + combining diaeresis vs composed "ü"
    const decomposed = 'Mu\u0308nchen';
    expect(toCanonicalText(decomposed)).toBe('München');
  });

  describe('property-based idempotency', () => {
    const MARKUP_CHARACTERS = [
      'a',
      'B',
      '7',
      '|',
      ':',
      '-',
      ' ',
      '\t',
      '\r',
      '\n',
      '\0',
      '\u0301',
      '\ufeff',
    ];
    const markup = fc
      .array(fc.constantFrom(...MARKUP_CHARACTERS), { maxLength: 300 })
      .map((chars) => chars.join(''));
    const anyText = fc.oneof(markup, fc.string({ unit: 'binary' }));

    it('is strictly idempotent: toCanonicalText(f(x)) === f(x)', () => {
      fc.assert(
        fc.property(anyText, (raw) => {
          const once = toCanonicalText(raw);
          expect(toCanonicalText(once)).toBe(once);
        })
      );
    });

    it('leaves no carriage return, control character, trailing space or excess blank lines', () => {
      fc.assert(
        fc.property(anyText, (raw) => {
          const text = toCanonicalText(raw);

          for (const unwanted of ['\r', '\0', '\ufeff', ' \n', '\t\n', '\n\n\n']) {
            expect(text).not.toContain(unwanted);
          }
          expect(text).toBe(text.trim());
          expect(text).toBe(text.normalize('NFC'));
        })
      );
    });
  });

  describe('Markdown table repair', () => {
    const cell = fc.stringMatching(/^[A-Za-z0-9 ]{0,12}$/);
    const alignment = fc.constantFrom(':---', '---:', ':---:', '---');
    const row = (cells: string[]) => `| ${cells.join(' | ')} |`;

    it('gives the delimiter row the exact column count of the header', () => {
      fc.assert(
        fc.property(
          fc.array(cell, { minLength: 1, maxLength: 8 }),
          fc.array(alignment, { minLength: 1, maxLength: 8 }),
          fc.array(cell, { minLength: 1, maxLength: 8 }),
          (header, alignments, body) => {
            const text = toCanonicalText(`${row(header)}\n${row(alignments)}\n${row(body)}`);
            const [, delimiter] = text.split('\n');
            const cells = (delimiter ?? '').replace(/^\|\s*|\s*\|$/g, '').split(/\s*\|\s*/);

            expect(cells).toHaveLength(header.length);
          }
        )
      );
    });

    it('leaves a well-formed table unchanged', () => {
      const table = '| Spalte 1 | Spalte 2 |\n| :--- | :--- |\n| Wert 1 | Wert 2 |';
      expect(toCanonicalText(table)).toBe(table);
    });

    it('leaves non-table dash lines (e.g. Setext-Headings) intact', () => {
      expect(toCanonicalText('Kaufvertrag\n-----')).toBe('Kaufvertrag\n-----');
    });
  });
});
