import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthzError } from '@/lib/auth/require-permission';
import { PERMISSION_ACTIONS } from '@/types/auth';

const mockCreateSignedUploadUrl = vi.fn();
vi.mock('@/lib/storage/storage-service', () => ({
  createSignedUploadUrl: (...args: unknown[]) => mockCreateSignedUploadUrl(...args),
}));

const mockGetUser = vi.fn();
const mockRequirePermission = vi.fn();

vi.mock('@/lib/auth/require-permission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-permission')>()),
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerAuthClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    })
  ),
}));

describe('API Route: POST /api/storage/upload-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockRequirePermission.mockRejectedValue(
      new AuthzError(401, 'Nicht authentifiziert oder keine Kanzlei zugeordnet.')
    );

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/storage/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName: 'kaufvertrag.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      PERMISSION_ACTIONS.UPLOAD_DOCUMENTS,
      expect.objectContaining({ route: 'POST /api/storage/upload-url' })
    );
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.error).toContain('Nicht authentifiziert');
  });

  it('rejects invalid request payloads with 400', async () => {
    mockRequirePermission.mockResolvedValue({
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
    });

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/storage/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName: '', // empty
        fileType: 'application/pdf',
        fileSize: -10, // invalid size
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates signed upload URL and returns 201 for valid authenticated request', async () => {
    const orgId = '550e8400-e29b-41d4-a716-446655440000';
    mockRequirePermission.mockResolvedValue({ organizationId: orgId });
    mockCreateSignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://storage.example.com/signed-upload',
      storagePath: `${orgId}/uuid-kaufvertrag.pdf`,
      token: 'token-abc',
    });

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/storage/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName: 'kaufvertrag.pdf',
        fileType: 'application/pdf',
        fileSize: 2048500,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.uploadUrl).toBe('https://storage.example.com/signed-upload');
    expect(data.storagePath).toBe(`${orgId}/uuid-kaufvertrag.pdf`);
    expect(mockCreateSignedUploadUrl).toHaveBeenCalled();
  });

  it('successfully creates signed upload URL for demo organization d0000000-0000-0000-0000-000000000001', async () => {
    const demoOrgId = 'd0000000-0000-0000-0000-000000000001';
    mockRequirePermission.mockResolvedValue({ organizationId: demoOrgId });
    mockCreateSignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://storage.example.com/signed-upload-demo',
      storagePath: `${demoOrgId}/uuid-kaufvertrag.png`,
      token: 'demo-token',
    });

    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost:3000/api/storage/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName: 'Kaufvertrag_Scan.png',
        fileType: 'image/png',
        fileSize: 450000,
        organizationId: demoOrgId,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.uploadUrl).toBe('https://storage.example.com/signed-upload-demo');
    expect(data.storagePath).toBe(`${demoOrgId}/uuid-kaufvertrag.png`);
  });
});
