import { NextRequest } from 'next/server';
import { describe, it, expect } from 'vitest';
import { getJobRepository } from '@/lib/supabase/server';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS } from '@/types/jobs';
import { GET, POST } from './route';

describe('API Route: /api/jobs (List & Retry)', () => {
  const repo = getJobRepository();

  it('GET /api/jobs returns list of all jobs', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Test List Job',
    });

    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.jobs)).toBe(true);
    const found = data.jobs.find((j: { id: string }) => j.id === job.id);
    expect(found).toBeDefined();
    expect(found.payload.notes).toBe('Test List Job');
  });

  it('POST /api/jobs retries a failed job', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Failing Job',
    });

    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.FAILED,
      errorMessage: 'Network timeout',
      retryCount: 1,
    });

    const req = new NextRequest('http://localhost:3000/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ jobId: job.id }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobId).toBe(job.id);
    expect(data.status).toBe(JOB_STATUS.PENDING);

    const updatedJob = await repo.getJobById(job.id);
    expect(updatedJob?.status).toBe(JOB_STATUS.PROCESSING);
  });

  it('POST /api/jobs returns 400 when jobId is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('POST /api/jobs returns 404 when job does not exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ jobId: 'non-existent-uuid' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
