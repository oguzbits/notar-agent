import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { JOB_STATUS } from '@/types/jobs';
import { POST } from './route';

const mockExecuteDossierJob = vi.fn();

vi.mock('@/lib/jobs/job-worker', () => ({
  executeDossierJob: (jobId: string) => mockExecuteDossierJob(jobId),
}));

describe('API Route: POST /api/jobs/process-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_WEBHOOK_SECRET = 'test-secret-token-123';
  });

  it('gibt 401 Unauthorized zurück, wenn das Secret fehlt oder ungültig ist', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/process-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': 'falsches-secret',
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Ungültiges oder fehlendes Webhook-Secret');
    expect(mockExecuteDossierJob).not.toHaveBeenCalled();
  });

  it('gibt 400 Bad Request zurück, wenn der Payload ungültig ist', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/process-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': 'test-secret-token-123',
      },
      body: JSON.stringify({ invalid: 'payload' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Ungültiger Webhook-Payload');
    expect(mockExecuteDossierJob).not.toHaveBeenCalled();
  });

  it('ignoriert Events für Jobs, die nicht im Status PENDING sind', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/process-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': 'test-secret-token-123',
      },
      body: JSON.stringify({
        type: 'UPDATE',
        table: DB_TABLES.DOSSIER_JOBS,
        record: {
          id: 'job-123',
          status: JOB_STATUS.COMPLETED,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Job ignoriert (nicht PENDING)');
    expect(mockExecuteDossierJob).not.toHaveBeenCalled();
  });

  it('führt executeDossierJob aus, wenn der Job im Status PENDING ist', async () => {
    mockExecuteDossierJob.mockResolvedValueOnce({ id: 'job-123', status: JOB_STATUS.COMPLETED });

    const req = new NextRequest('http://localhost:3000/api/jobs/process-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': 'test-secret-token-123',
      },
      body: JSON.stringify({
        type: 'INSERT',
        table: DB_TABLES.DOSSIER_JOBS,
        record: {
          id: 'job-123',
          status: JOB_STATUS.PENDING,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.jobId).toBe('job-123');
    expect(mockExecuteDossierJob).toHaveBeenCalledWith('job-123');
  });
});
