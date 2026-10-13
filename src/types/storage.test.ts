import { describe, it, expect } from 'vitest';
import {
  STORAGE_BUCKET_NAMES,
  CreateUploadUrlRequestSchema,
  CreateUploadUrlResponseSchema,
} from './storage';

describe('Storage Types & Schemas', () => {
  it('defines canonical dossier-files bucket name', () => {
    expect(STORAGE_BUCKET_NAMES.DOSSIER_FILES).toBeDefined();
    expect(typeof STORAGE_BUCKET_NAMES.DOSSIER_FILES).toBe('string');
  });

  it('validates valid CreateUploadUrlRequest', () => {
    const valid = {
      fileName: 'grundbuch.pdf',
      fileType: 'application/pdf',
      fileSize: 1024000,
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const parsed = CreateUploadUrlRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid CreateUploadUrlRequest with empty fileName or zero size', () => {
    const invalid = {
      fileName: '',
      fileType: 'application/pdf',
      fileSize: 0,
    };
    const parsed = CreateUploadUrlRequestSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates CreateUploadUrlResponse', () => {
    const response = {
      uploadUrl: 'https://example.supabase.co/storage/v1/upload/signed/...',
      storagePath: '550e8400-e29b-41d4-a716-446655440000/job-1/grundbuch.pdf',
      token: 'jwt-token-123',
    };
    const parsed = CreateUploadUrlResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });
});
