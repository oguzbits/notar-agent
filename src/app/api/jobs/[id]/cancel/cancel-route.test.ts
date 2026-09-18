import { NextRequest } from 'next/server';
import { describe, it, expect } from 'vitest';
import { getJobRepository } from '@/lib/supabase/server';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS } from '@/types/jobs';
import { POST } from './route';

describe('API Route: POST /api/jobs/[id]/cancel', () => {
  const repo = getJobRepository();

  it('returns 404 when job does not exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/non-existing-id/cancel', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'non-existing-id' }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('nicht gefunden');
  });

  it('returns 400 when job is already completed or failed', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Completed Job',
    });

    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.COMPLETED,
    });

    const req = new NextRequest(`http://localhost:3000/api/jobs/${job.id}/cancel`, {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: job.id }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('nicht mehr abgebrochen');
  });

  it('cancels active job and returns 200 with cancelled job details', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Active Job to Cancel',
    });

    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.PROCESSING,
    });

    const req = new NextRequest(`http://localhost:3000/api/jobs/${job.id}/cancel`, {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: job.id }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.job.status).toBe(JOB_STATUS.CANCELLED);
    expect(data.message).toContain('erfolgreich abgebrochen');

    const updatedJob = await repo.getJobById(job.id);
    expect(updatedJob?.status).toBe(JOB_STATUS.CANCELLED);
  });
});
