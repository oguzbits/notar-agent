import { describe, it, expect } from 'vitest';
import { extractPdfUnicodeText } from './pdf-text-extractor';

describe('pdf-text-extractor (unpdf)', () => {
  it('extracts literal strings from valid PDF streams accurately', async () => {
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
    const text = await extractPdfUnicodeText(buffer);

    expect(text).toContain('Kaufpreis: 1.250.000 EUR');
  });

  it('returns empty string gracefully if no text streams or invalid PDF', async () => {
    const emptyPdf = `%PDF-1.4 %%EOF`;
    const buffer = Buffer.from(emptyPdf, 'utf-8');
    const text = await extractPdfUnicodeText(buffer);

    expect(text).toBe('');
  });

  it('extracts form annotations from documents like Energieausweis', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(
      process.cwd(),
      'test-akten/fall-06-energieausweis-prueffrist/Energieausweis_AachenerStr.pdf'
    );
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const text = await extractPdfUnicodeText(buffer);

      expect(text).toContain('10.02.2023');
      expect(text).toContain('182,0');
      expect(text).toContain('Aachener Str. 44');
    }
  });
});
