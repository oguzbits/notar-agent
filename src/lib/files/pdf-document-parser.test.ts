import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parsePdfDocument } from './pdf-document-parser';

describe('pdf-document-parser (LiteParse integration)', () => {
  it('parses standard digital Kaufvertrag with Markdown structure and headings', async () => {
    const filePath = path.resolve(
      process.cwd(),
      'test-akten/fall-04-standard-urkunde/Kaufvertrag_Koeln_UR89.pdf'
    );
    const buffer = fs.readFileSync(filePath);

    const result = await parsePdfDocument(buffer);

    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    expect(result.hasTextLayer).toBe(true);
    expect(result.markdown).toContain('URKUNDENROLLE NR. 2026/89');
    expect(result.markdown).toContain('Maria Fischer');
    expect(result.markdown).toContain('Jan Schmidt');
    expect(result.markdown).toContain('550.000,00 EUR');
  });

  it('detects complex/form documents and extracts text content gracefully', async () => {
    const filePath = path.resolve(
      process.cwd(),
      'test-akten/fall-06-energieausweis-prueffrist/Energieausweis_AachenerStr.pdf'
    );
    const buffer = fs.readFileSync(filePath);

    const result = await parsePdfDocument(buffer);

    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    expect(result.hasTextLayer).toBe(true);
    expect(result.markdown).toContain('Gebäude');
    expect(result.markdown).toContain('10.02.2023');
    expect(result.markdown).toContain('182,0');
    expect(result.markdown).toContain('Aachener Str. 44');
  });

  it('extracts literal strings from valid synthetic PDF streams accurately', async () => {
    const syntheticPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 55 >>
stream
BT
/F1 12 Tf
72 712 Td
(Kaufpreis: 1.250.000 EUR) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000224 00000 n 
0000000329 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
403
%%EOF`;
    const buffer = Buffer.from(syntheticPdf, 'utf-8');
    const result = await parsePdfDocument(buffer);

    expect(result.markdown).toContain('Kaufpreis: 1.250.000 EUR');
  });

  it('handles invalid or empty PDF buffers without throwing unhandled exceptions', async () => {
    const emptyPdf = Buffer.from('%PDF-1.4 %%EOF');
    const result = await parsePdfDocument(emptyPdf);

    expect(result.totalPages).toBe(0);
    expect(result.hasTextLayer).toBe(false);
    expect(result.markdown).toBe('');
  });
});
