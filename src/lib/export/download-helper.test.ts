import { saveAs } from 'file-saver';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadJsonFile, downloadTextFile } from './download-helper';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

describe('download-helper with file-saver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes json into a Blob and invokes saveAs', () => {
    const payload = { dossier: 'Immobilienkauf', id: '123' };
    downloadJsonFile('export.json', payload);

    expect(saveAs).toHaveBeenCalledTimes(1);
    const [blobArg, filenameArg] = vi.mocked(saveAs).mock.calls[0] as [Blob, string];
    expect(filenameArg).toBe('export.json');
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('application/json;charset=utf-8;');
  });

  it('converts text content into a Blob and invokes saveAs', () => {
    downloadTextFile('pruefbericht.txt', 'Vollständiger Notarbericht');

    expect(saveAs).toHaveBeenCalledTimes(1);
    const [blobArg, filenameArg] = vi.mocked(saveAs).mock.calls[0] as [Blob, string];
    expect(filenameArg).toBe('pruefbericht.txt');
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/plain;charset=utf-8;');
  });
});
