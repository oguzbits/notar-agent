import { describe, it, expect, vi } from 'vitest';
import { STORAGE_BUCKET_NAMES } from '@/types/storage';
import {
  createSignedUploadUrl,
  downloadFileBuffer,
  deleteStorageFile,
  deleteStorageFiles,
  sanitizeStorageFileName,
  resolveFileBuffer,
} from './storage-service';

describe('Storage Service', () => {
  describe('sanitizeStorageFileName', () => {
    it('sanitizes unsafe characters and directory traversal', () => {
      expect(sanitizeStorageFileName('../../etc/passwd.pdf')).toBe('etc-passwd.pdf');
      expect(sanitizeStorageFileName('Kaufvertrag Entwurf (1).pdf')).toBe(
        'Kaufvertrag-Entwurf-(1).pdf'
      );
      expect(sanitizeStorageFileName('   ')).toBe('document.bin');
    });
  });

  describe('createSignedUploadUrl', () => {
    it('generates a signed upload URL with tenant prefix in dossier-files bucket', async () => {
      const mockCreateSignedUploadUrl = vi.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://supabase.co/storage/v1/upload/sign/test',
          token: 'signed-token-123',
        },
        error: null,
      });

      const mockStorage = {
        from: vi.fn().mockReturnValue({
          createSignedUploadUrl: mockCreateSignedUploadUrl,
        }),
      };
      const mockSupabase = { storage: mockStorage } as never;

      const result = await createSignedUploadUrl(mockSupabase, {
        organizationId: 'org-abc-123',
        fileName: 'kaufvertrag.pdf',
      });

      expect(mockStorage.from).toHaveBeenCalledWith(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
      expect(result.uploadUrl).toBe('https://supabase.co/storage/v1/upload/sign/test');
      expect(result.storagePath).toMatch(/^org-abc-123\/[a-f0-9-]+-kaufvertrag\.pdf$/);
    });

    it('throws when storage returns an error', async () => {
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Bucket not found' },
          }),
        }),
      };
      const mockSupabase = { storage: mockStorage } as never;

      await expect(
        createSignedUploadUrl(mockSupabase, {
          organizationId: 'org-123',
          fileName: 'doc.pdf',
        })
      ).rejects.toThrow('Storage Upload-URL Erstellung fehlgeschlagen: Bucket not found');
    });
  });

  describe('downloadFileBuffer', () => {
    it('downloads file blob and converts to node Buffer', async () => {
      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
      };

      const mockDownload = vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      const mockStorage = {
        from: vi.fn().mockReturnValue({
          download: mockDownload,
        }),
      };
      const mockSupabase = { storage: mockStorage } as never;

      const buffer = await downloadFileBuffer(mockSupabase, 'org-123/doc.pdf');

      expect(mockStorage.from).toHaveBeenCalledWith(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
      expect(mockDownload).toHaveBeenCalledWith('org-123/doc.pdf');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer).toEqual(Buffer.from([1, 2, 3, 4]));
    });

    it('throws when download fails', async () => {
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Object not found' },
          }),
        }),
      };
      const mockSupabase = { storage: mockStorage } as never;

      await expect(downloadFileBuffer(mockSupabase, 'org-123/missing.pdf')).rejects.toThrow(
        'Storage Download fehlgeschlagen: Object not found'
      );
    });
  });

  describe('deleteStorageFile', () => {
    it('deletes file from storage bucket', async () => {
      const mockRemove = vi.fn().mockResolvedValue({
        data: [{ name: 'org-123/doc.pdf' }],
        error: null,
      });

      const mockStorage = {
        from: vi.fn().mockReturnValue({
          remove: mockRemove,
        }),
      };
      const mockSupabase = { storage: mockStorage } as never;

      const success = await deleteStorageFile(mockSupabase, 'org-123/doc.pdf');

      expect(mockStorage.from).toHaveBeenCalledWith(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
      expect(mockRemove).toHaveBeenCalledWith(['org-123/doc.pdf']);
      expect(success).toBe(true);
    });
  });

  describe('deleteStorageFiles', () => {
    it('deletes multiple files from storage bucket in batch', async () => {
      const mockRemove = vi.fn().mockResolvedValue({
        data: [{ name: 'org-1/f1.pdf' }, { name: 'org-1/f2.pdf' }],
        error: null,
      });

      const mockStorage = {
        from: vi.fn().mockReturnValue({
          remove: mockRemove,
        }),
      };
      const mockSupabase = { storage: mockStorage } as never;

      const success = await deleteStorageFiles(mockSupabase, ['org-1/f1.pdf', 'org-1/f2.pdf']);

      expect(mockStorage.from).toHaveBeenCalledWith(STORAGE_BUCKET_NAMES.DOSSIER_FILES);
      expect(mockRemove).toHaveBeenCalledWith(['org-1/f1.pdf', 'org-1/f2.pdf']);
      expect(success).toBe(true);
    });

    it('returns true without calling storage if paths array is empty', async () => {
      const mockStorage = {
        from: vi.fn(),
      };
      const mockSupabase = { storage: mockStorage } as never;

      const success = await deleteStorageFiles(mockSupabase, []);

      expect(mockStorage.from).not.toHaveBeenCalled();
      expect(success).toBe(true);
    });

    it('throws error when remove returns error', async () => {
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          remove: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'Permission denied' } }),
        }),
      };
      const mockSupabase = { storage: mockStorage } as never;

      await expect(deleteStorageFiles(mockSupabase, ['org-1/f1.pdf'])).rejects.toThrow(
        'Storage Löschen fehlgeschlagen: Permission denied'
      );
    });
  });

  describe('resolveFileBuffer', () => {
    it('resolves buffer from storagePath via downloadFileBuffer', async () => {
      const mockBlob = {
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([10, 20, 30]).buffer),
      };
      const mockStorage = {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue({ data: mockBlob, error: null }),
        }),
      };
      const mockSupabase = { storage: mockStorage } as never;

      const buffer = await resolveFileBuffer(
        { name: 'akte.pdf', storagePath: 'org-1/uuid-akte.pdf' },
        mockSupabase
      );

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer).toEqual(Buffer.from([10, 20, 30]));
    });

    it('resolves buffer from base64 content with data URL prefix', async () => {
      const base64Data = Buffer.from('PDF_CONTENT').toString('base64');
      const buffer = await resolveFileBuffer({
        name: 'test.pdf',
        content: `data:application/pdf;base64,${base64Data}`,
        isBase64: true,
      });

      expect(buffer.toString('utf-8')).toBe('PDF_CONTENT');
    });

    it('resolves buffer from raw text content', async () => {
      const buffer = await resolveFileBuffer({
        name: 'notes.txt',
        content: 'Notizen zum Kaufvertrag',
      });

      expect(buffer.toString('utf-8')).toBe('Notizen zum Kaufvertrag');
    });

    it('throws when neither storagePath nor content is present', async () => {
      await expect(
        resolveFileBuffer({
          name: 'empty.pdf',
        })
      ).rejects.toThrow(
        'Datei "empty.pdf" enthält weder einen gültigen storagePath noch Dateiinhalt.'
      );
    });
  });
});
