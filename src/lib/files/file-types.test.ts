/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  FILE_CATEGORIES,
  SUPPORTED_FILE_TYPES,
  getFileExtension,
  detectMimeFromBuffer,
  resolveFileCategory,
  getSupportedUploadAcceptString,
} from './file-types';

describe('file-types declarative registry with file-type', () => {
  it('extracts lowercase file extensions correctly', () => {
    expect(getFileExtension('urkunde.PDF')).toBe('.pdf');
    expect(getFileExtension('scan.JPEG')).toBe('.jpeg');
    expect(getFileExtension('datei_ohne_endung')).toBe('');
    expect(getFileExtension('akte.v1.final.docx')).toBe('.docx');
  });

  it('detects PDF mime from buffer via file-type', async () => {
    // Reale minimale PDF-Bytes (%PDF-1.4 ...)
    const pdfString = '%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF';
    const pdfBytes = new TextEncoder().encode(pdfString);

    const mime = await detectMimeFromBuffer(pdfBytes);
    expect(mime).toBe('application/pdf');
  });

  it('detects PNG image mime from buffer via file-type', async () => {
    // Minimale PNG-Signatur (8 Bytes: 89 50 4E 47 0D 0A 1A 0A) + IHDR Chunk Header
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89,
    ]);

    const mime = await detectMimeFromBuffer(pngBytes);
    expect(mime).toBe('image/png');
  });

  it('resolves category by buffer sniffing with highest precedence', async () => {
    // Datei heißt .txt, hat aber echten PDF-Inhalt
    const pdfString = '%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF';
    const fakeTxtWithPdfBytes = new TextEncoder().encode(pdfString);

    const category = await resolveFileCategory(
      { name: 'tarnung.txt', type: 'text/plain' },
      fakeTxtWithPdfBytes
    );

    expect(category).toBe(FILE_CATEGORIES.PDF);
  });

  it('resolves category by extension when mime type is missing or generic octet-stream', async () => {
    expect(await resolveFileCategory({ name: 'vertrag.pdf', type: '' })).toBe(FILE_CATEGORIES.PDF);
    expect(await resolveFileCategory({ name: 'scan.PNG', type: 'application/octet-stream' })).toBe(
      FILE_CATEGORIES.IMAGE
    );
    expect(await resolveFileCategory({ name: 'anschreiben.eml', type: '' })).toBe(
      FILE_CATEGORIES.TEXT
    );
    expect(await resolveFileCategory({ name: 'unbekannt.xyz', type: '' })).toBe(
      FILE_CATEGORIES.BINARY
    );
  });

  it('generates a valid HTML file accept string', () => {
    const accept = getSupportedUploadAcceptString();
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.jpg');
    expect(accept).toContain('.eml');
    expect(accept).toContain('application/pdf');
  });

  it('declares mandatory supported file definitions', () => {
    expect(SUPPORTED_FILE_TYPES.length).toBeGreaterThanOrEqual(3);
  });
});
