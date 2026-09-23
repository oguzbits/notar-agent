import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getJobRepository } from '@/lib/supabase/server';
import { createMockJobRepository } from '@/test/fixtures/mock-repositories';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS, JOB_STAGES } from '@/types/jobs';
import { GET } from './route';

const mockJobRepo = createMockJobRepository();

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/server')>();
  return {
    ...actual,
    getJobRepository: () => mockJobRepo,
    getServerSupabase: vi.fn(),
  };
});

describe('API Route: GET /api/jobs/[id]', () => {
  const repo = getJobRepository();

  beforeEach(async () => {
    //
  });

  it('returns 404 when job is not found', async () => {
    const req = new NextRequest('http://localhost:3000/api/jobs/non-existing-id');
    const res = await GET(req, { params: Promise.resolve({ id: 'non-existing-id' }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('nicht gefunden');
  });

  it('returns 200 with job details when job exists', async () => {
    const job = await repo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: 'Testauftrag',
    });

    await repo.updateJobStatus(job.id, {
      status: JOB_STATUS.PROCESSING,
      stage: JOB_STAGES.EXTRACTION,
      progressDetails: {
        currentStep: 2,
        totalSteps: 4,
        processedUnits: 1,
        totalUnits: 2,
        currentActivity: 'Beteiligte extrahieren...',
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/jobs/${job.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: job.id }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(job.id);
    expect(data.status).toBe(JOB_STATUS.PROCESSING);
    expect(data.stage).toBe(JOB_STAGES.EXTRACTION);
    expect(data.progressDetails?.currentStep).toBe(2);
    expect(data.progressDetails?.currentActivity).toBe('Beteiligte extrahieren...');
  });
});
