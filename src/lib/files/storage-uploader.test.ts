import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFileDirectly, uploadFilesDirectly } from './storage-uploader';

describe('Storage Direct Uploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests signed upload URL and uploads file directly via PUT', async () => {
    const mockFile = new File(['PDF_DATA'], 'vertrag.pdf', { type: 'application/pdf' });

    global.fetch = vi
      .fn()
      // First fetch: POST /api/storage/upload-url
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadUrl: 'https://storage.supabase.co/upload/signed-test',
          storagePath: 'org-123/uuid-vertrag.pdf',
        }),
      } as Response)
      // Second fetch: PUT uploadUrl
      .mockResolvedValueOnce({
        ok: true,
      } as Response);

    const result = await uploadFileDirectly(mockFile, { organizationId: 'org-123' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/storage/upload-url',
      expect.objectContaining({
        method: 'POST',
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://storage.supabase.co/upload/signed-test',
      expect.objectContaining({
        method: 'PUT',
        body: mockFile,
      })
    );

    expect(result.storagePath).toBe('org-123/uuid-vertrag.pdf');
    expect(result.name).toBe('vertrag.pdf');
    expect(result.content).toBeUndefined();
  });

  it('falls back to local base64 preparation if signed upload URL request fails', async () => {
    const mockFile = new File(['TEXT_DATA'], 'notiz.txt', { type: 'text/plain' });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await uploadFileDirectly(mockFile);

    expect(result.name).toBe('notiz.txt');
    expect(result.content).toBeDefined();
    expect(result.storagePath).toBeUndefined();
  });

  it('uploads multiple files concurrently via uploadFilesDirectly', async () => {
    const mockFile1 = new File(['A'], 'file1.pdf', { type: 'application/pdf' });
    const mockFile2 = new File(['B'], 'file2.pdf', { type: 'application/pdf' });

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/storage/upload-url') {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            uploadUrl: `https://storage.supabase.co/upload/${body.fileName}`,
            storagePath: `org-1/${body.fileName}`,
          }),
        } as Response;
      }
      return { ok: true } as Response;
    });

    const results = await uploadFilesDirectly([mockFile1, mockFile2], {
      organizationId: 'org-1',
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.storagePath).toBe('org-1/file1.pdf');
    expect(results[1]?.storagePath).toBe('org-1/file2.pdf');
  });

  it('meldet nach jeder fertigen Datei die Anzahl der abgeschlossenen und aller Dateien', async () => {
    const files = ['a', 'b', 'c'].map(
      (n) => new File([n], `${n}.pdf`, { type: 'application/pdf' })
    );
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/storage/upload-url') {
        const body = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: async () => ({
            uploadUrl: `https://s/${body.fileName}`,
            storagePath: body.fileName,
          }),
        } as Response;
      }
      return { ok: true } as Response;
    });
    const onProgress = vi.fn();

    await uploadFilesDirectly(files, { onProgress });

    expect(onProgress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });
});
