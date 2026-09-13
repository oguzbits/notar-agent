import { describe, it, expect } from 'vitest';
import { validateFiles, MAX_FILE_SIZE_BYTES } from './file-preparer';

describe('file-preparer service', () => {
  it('validiert Dateien innerhalb der Größenbegrenzung erfolgreich', () => {
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    const result = validateFiles([file]);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('erkennt Dateien, die das 32MB Hardlimit überschreiten', () => {
    // Reales File-Objekt mit modifizierter size-Eigenschaft (kein Cast nötig)
    const bigFile = new File([''], 'riesen_scan.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: MAX_FILE_SIZE_BYTES + 1024 });

    const result = validateFiles([bigFile]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('überschreitet die maximale Dateigröße von 32 MB');
    expect(result.error).toContain('riesen_scan.pdf');
  });

  it('bereitet PDF-Dateien für den Upload als Base64-Payload vor', async () => {
    const pdfContent = '%PDF-1.4 test';
    const pdfFile = new File([pdfContent], 'urkunde.pdf', { type: 'application/pdf' });

    const { prepareFiles } = await import('./file-preparer');
    const prepared = await prepareFiles([pdfFile]);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.name).toBe('urkunde.pdf');
    expect(prepared[0]?.type).toBe('application/pdf');
    expect(prepared[0]?.isBase64).toBe(true);
    expect(prepared[0]?.content).toContain('data:application/pdf;base64,');
  });

  it('bereitet Textdateien als Plaintext-Payload vor', async () => {
    const textFile = new File(['Hinweis zum Notartermin'], 'notizen.txt', { type: 'text/plain' });

    const { prepareFiles } = await import('./file-preparer');
    const prepared = await prepareFiles([textFile]);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.name).toBe('notizen.txt');
    expect(prepared[0]?.isBase64).toBe(false);
    expect(prepared[0]?.content).toBe('Hinweis zum Notartermin');
  });

  it('verarbeitet gemischte Dateien mit unterschiedlichen Endungen parallel (Strategy Pattern)', async () => {
    const files = [
      new File(['%PDF-1.4 urkunde'], 'kaufvertrag.PDF', { type: '' }),
      new File(['E-Mail Korrespondenz'], 'anschreiben.eml', { type: '' }),
      new File(['test binary'], 'unbekannt.dat', { type: 'application/octet-stream' }),
    ];

    const { prepareFiles } = await import('./file-preparer');
    const prepared = await prepareFiles(files);

    expect(prepared).toHaveLength(3);
    // PDF erkannt trotz Großschreibung und leerem MIME-Type
    expect(prepared[0]?.name).toBe('kaufvertrag.PDF');
    expect(prepared[0]?.type).toBe('application/pdf');
    expect(prepared[0]?.isBase64).toBe(true);

    // EML als Text erkannt
    expect(prepared[1]?.name).toBe('anschreiben.eml');
    expect(prepared[1]?.isBase64).toBe(false);

    // Binary Fallback
    expect(prepared[2]?.name).toBe('unbekannt.dat');
    expect(prepared[2]?.type).toBe('application/octet-stream');
    expect(prepared[2]?.isBase64).toBe(true);
  });
});
