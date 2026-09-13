import { describe, it, expect } from 'vitest';
import {
  classifyPdfStream,
  PDF_STREAM_TYPES,
  type PdfStreamClassification,
} from './pdf-stream-classifier';

describe('pdf-stream-classifier', () => {
  it('identifies digital-born PDF with text layer and zero raster images', async () => {
    // Synthetischer PDF-Inhalt: Reiner Textlayer mit BT...ET und Tj
    const syntheticTextPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >>
stream
BT
/F1 12 Tf
72 712 Td
(Kaufvertrag Urkundenrolle Nr. 1234/2026 Notar Dr. Weber Kaufpreis EUR 450.000 Flurstueck 102/4) Tj
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
0000000394 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
468
%%EOF`;
    const buffer = Buffer.from(syntheticTextPdf, 'utf-8');

    const result: PdfStreamClassification = await classifyPdfStream(buffer);

    expect(result.streamType).toBe(PDF_STREAM_TYPES.DIGITAL_BORN_TEXT);
    expect(result.hasTextLayer).toBe(true);
    expect(result.hasRasterImages).toBe(false);
    expect(result.characterCount).toBeGreaterThan(50);
  });

  it('identifies scanned image PDF with raster image XObject and no text layer', async () => {
    const syntheticScanPdf = `
      %PDF-1.4
      1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
      2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
      3 0 obj << /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 5 0 R >> >> >> endobj
      5 0 obj << /Type /XObject /Subtype /Image /Width 1000 /Height 1400 /Filter /DCTDecode >>
      stream
      ...binary image data...
      endstream
      endobj
      trailer << /Root 1 0 R >>
      %%EOF
    `;
    const buffer = Buffer.from(syntheticScanPdf, 'utf-8');

    const result = await classifyPdfStream(buffer);

    expect(result.streamType).toBe(PDF_STREAM_TYPES.SCANNED_IMAGE);
    expect(result.hasTextLayer).toBe(false);
    expect(result.hasRasterImages).toBe(true);
  });

  it('identifies hybrid composite PDF with text layer AND embedded raster images', async () => {
    const syntheticHybridPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> /XObject << /Seal 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >>
stream
BT
/F1 12 Tf
72 712 Td
(Beglaubigungsvermerk: Die Echtheit der vorstehenden Unterschrift wird beglaubigt. Notar Siegel und Stempel) Tj
ET
endstream
endobj
5 0 obj << /Type /XObject /Subtype /Image /Width 10 /Height 10 /Filter /DCTDecode >>
stream
...amts-siegel...
endstream
endobj
6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000252 00000 n 
0000000422 00000 n 
0000000522 00000 n 
trailer << /Size 7 /Root 1 0 R >>
startxref
596
%%EOF`;
    const buffer = Buffer.from(syntheticHybridPdf, 'utf-8');

    const result = await classifyPdfStream(buffer);

    expect(result.streamType).toBe(PDF_STREAM_TYPES.HYBRID_COMPOSITE);
    expect(result.hasTextLayer).toBe(true);
    expect(result.hasRasterImages).toBe(true);
  });

  it('safely handles empty or corrupt PDF buffers by falling back to SCANNED_IMAGE for vision safety', async () => {
    const corruptBuffer = Buffer.from('not a pdf at all', 'utf-8');

    const result = await classifyPdfStream(corruptBuffer);

    expect(result.streamType).toBe(PDF_STREAM_TYPES.SCANNED_IMAGE);
    expect(result.hasTextLayer).toBe(false);
  });
});
