import { describe, it, expect } from 'vitest';
import {
  classifyPdfStream,
  PDF_STREAM_TYPES,
  type PdfStreamClassification,
} from './pdf-stream-classifier';

describe('pdf-stream-classifier', () => {
  it('identifies digital-born PDF with text layer and zero raster images', () => {
    // Synthetischer PDF-Inhalt: Reiner Textlayer mit BT...ET und Tj
    const syntheticTextPdf = `
      %PDF-1.4
      1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
      2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
      3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj
      4 0 obj << /Length 120 >>
      stream
      BT
      /F1 12 Tf
      72 712 Td
      (Kaufvertrag Urkundenrolle Nr. 1234/2026 Notar Dr. Weber Kaufpreis EUR 450.000 Flurstueck 102/4) Tj
      ET
      endstream
      endobj
      xref
      trailer << /Root 1 0 R >>
      %%EOF
    `;
    const buffer = Buffer.from(syntheticTextPdf, 'utf-8');

    const result: PdfStreamClassification = classifyPdfStream(buffer);

    expect(result.streamType).toBe(PDF_STREAM_TYPES.DIGITAL_BORN_TEXT);
    expect(result.hasTextLayer).toBe(true);
    expect(result.hasRasterImages).toBe(false);
    expect(result.characterCount).toBeGreaterThan(50);
  });

  it('identifies scanned image PDF with raster image XObject and no text layer', () => {
    // Synthetischer Scan: Enthält /Subtype /Image und keinen Text-Stream
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

    const result = classifyPdfStream(buffer);

    expect(result.streamType).toBe(PDF_STREAM_TYPES.SCANNED_IMAGE);
    expect(result.hasTextLayer).toBe(false);
    expect(result.hasRasterImages).toBe(true);
  });

  it('identifies hybrid composite PDF with text layer AND embedded raster images (e.g. seal/signature)', () => {
    // Synthetisches Hybrid-Dokument: Enthält Text und ein Bild-Objekt
    const syntheticHybridPdf = `
      %PDF-1.4
      1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
      2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
      3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /XObject << /Seal 5 0 R >> >> >> endobj
      4 0 obj
      stream
      BT
      (Beglaubigungsvermerk: Die Echtheit der vorstehenden Unterschrift wird beglaubigt. Notar Siegel) Tj
      ET
      endstream
      endobj
      5 0 obj << /Type /XObject /Subtype /Image /Width 300 /Height 300 /Filter /DCTDecode >>
      stream
      ...amts-siegel...
      endstream
      endobj
      trailer << /Root 1 0 R >>
      %%EOF
    `;
    const buffer = Buffer.from(syntheticHybridPdf, 'utf-8');

    const result = classifyPdfStream(buffer);

    expect(result.streamType).toBe(PDF_STREAM_TYPES.HYBRID_COMPOSITE);
    expect(result.hasTextLayer).toBe(true);
    expect(result.hasRasterImages).toBe(true);
  });

  it('safely handles empty or corrupt PDF buffers by falling back to SCANNED_IMAGE for vision safety', () => {
    const corruptBuffer = Buffer.from('not a pdf at all', 'utf-8');

    const result = classifyPdfStream(corruptBuffer);

    expect(result.streamType).toBe(PDF_STREAM_TYPES.SCANNED_IMAGE);
    expect(result.hasTextLayer).toBe(false);
  });
});
