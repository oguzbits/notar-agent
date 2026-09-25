import { describe, it, expect } from 'vitest';
import { parseDocumentLayoutStructure } from '@/lib/files/layout-structure-parser';

describe('parseDocumentLayoutStructure', () => {
  it('preserves plain unstructured text when no headings or tables are detected', () => {
    const raw = 'Dies ist ein einfacher Text.\nOhne besondere Struktur.';
    const result = parseDocumentLayoutStructure(raw);

    expect(result.hasStructuredBlocks).toBe(false);
    expect(result.structuredMarkdown).toBe(raw);
  });

  it('detects contract clause headers and partitions text into logical blocks', () => {
    const raw = `NOTARIELLER KAUFVERTRAG
§ 1 Vertragsgegenstand
Das Grundstück Gemarkung Mitte, Flur 4, Flurstück 101/2.

§ 2 Kaufpreis und Fälligkeit
Der Kaufpreis beträgt 450.000 Euro und ist fällig am 15. Oktober 2026.`;

    const result = parseDocumentLayoutStructure(raw);

    expect(result.hasStructuredBlocks).toBe(true);
    expect(result.blocks.length).toBeGreaterThanOrEqual(2);
    expect(result.structuredMarkdown).toContain('### § 1 Vertragsgegenstand');
    expect(result.structuredMarkdown).toContain('### § 2 Kaufpreis und Fälligkeit');
  });

  it('reconstructs tabular data with column alignment into markdown tables (e.g. Grundbuch / Mieterliste)', () => {
    const tableText = `Mieteinheit    Mieter Name         Kaltmiete    Kaution
WE 01          Max Mustermann       850 €        2.550 €
WE 02          Erika Musterfrau     920 €        2.760 €
WE 03          Hans Schmidt        1.100 €       3.300 €`;

    const result = parseDocumentLayoutStructure(tableText);

    expect(result.hasStructuredBlocks).toBe(true);
    // Sollte eine Markdown-Tabelle mit Header-Trennlinie (|---|---|) generieren
    expect(result.structuredMarkdown).toContain(
      '| Mieteinheit | Mieter Name | Kaltmiete | Kaution |'
    );
    expect(result.structuredMarkdown).toContain('|---|---|---|---|');
    expect(result.structuredMarkdown).toContain('| WE 01 | Max Mustermann | 850 € | 2.550 € |');
  });

  it('detects Grundbuch department headers (Abteilung I, II, III)', () => {
    const grundbuchText = `Amtsgericht Schöneberg von Berlin
Grundbuch von Mitte Blatt 1234
Bestandsverzeichnis
Lfd. Nr. 1 Gemarkung Mitte Flur 2 Flurstück 55

Abteilung I (Eigentümer)
1. Anna Schmidt, geb. 12.04.1980

Abteilung II (Lasten und Beschränkungen)
1. Geh- und Fahrrecht für Flurstück 56

Abteilung III (Grundpfandrechte)
1. 200.000 Euro Grundschuld für Deutsche Bank AG`;

    const result = parseDocumentLayoutStructure(grundbuchText);

    expect(result.hasStructuredBlocks).toBe(true);
    expect(result.structuredMarkdown).toContain('## Abteilung I (Eigentümer)');
    expect(result.structuredMarkdown).toContain('## Abteilung II (Lasten und Beschränkungen)');
    expect(result.structuredMarkdown).toContain('## Abteilung III (Grundpfandrechte)');
  });
});
