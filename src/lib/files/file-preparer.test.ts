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
    // Mock-Datei mit Übergröße
    const bigFile = {
      name: 'riesen_scan.pdf',
      size: MAX_FILE_SIZE_BYTES + 1024,
      type: 'application/pdf',
    } as unknown as File;

    const result = validateFiles([bigFile]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('überschreitet die maximale Dateigröße von 32 MB');
    expect(result.error).toContain('riesen_scan.pdf');
  });
});
