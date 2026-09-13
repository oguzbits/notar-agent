import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryJobRepository } from '@/lib/jobs/job-repository';
import { executeDossierJob, WorkerDependencies } from '@/lib/jobs/job-worker';
import { InMemoryDossierRepository } from '@/lib/supabase/repository';
import { createTestImmobilienDossier } from '@/test/fixtures/dossier-factory';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS, JOB_STAGES, computeJobProgressPercent } from '@/types/jobs';

describe('job-worker (executeDossierJob)', () => {
  let jobRepo: InMemoryJobRepository;
  let dossierRepo: InMemoryDossierRepository;

  const mockResultDossier = createTestImmobilienDossier();

  beforeEach(() => {
    jobRepo = new InMemoryJobRepository(10);
    dossierRepo = new InMemoryDossierRepository(10);
  });

  it('runs successfully through all stages and sets COMPLETED with resultDossierId', async () => {
    const pipelineMock: NonNullable<WorkerDependencies['pipelineFn']> = async ({ onStep }) => {
      onStep(1, 'Dokumente aufbereiten');
      onStep(2, 'Prüfnormen abgleichen');
      return mockResultDossier;
    };

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'scan.pdf', size: 100, type: 'application/pdf', content: 'test' }],
      notes: '',
    });

    const processedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      pipelineFn: pipelineMock,
    });

    expect(processedJob?.status).toBe(JOB_STATUS.COMPLETED);
    expect(processedJob?.stage).toBe(JOB_STAGES.PERSISTING);
    expect(processedJob?.progressDetails).toBeDefined();
    expect(processedJob?.progressDetails?.currentStep).toBe(4);
    expect(processedJob?.progressDetails?.totalSteps).toBe(4);
    expect(computeJobProgressPercent(processedJob!)).toBe(100);
    expect(processedJob?.resultDossierId).toBeDefined();

    // Verifiziere, dass das Dossier im Dossier-Repo gespeichert wurde
    const savedDossier = await dossierRepo.findById(processedJob?.resultDossierId ?? '');
    expect(savedDossier).not.toBeNull();
    expect(savedDossier?.content?.caseType).toBe(CASE_TYPES.IMMOBILIENKAUF);
  });

  it('catches pipeline errors, updates job to FAILED and increments retryCount', async () => {
    const failingPipeline: NonNullable<WorkerDependencies['pipelineFn']> = async () => {
      throw new Error('Anthropic API 500');
    };

    const job = await jobRepo.createJob({
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [],
      notes: '',
    });

    const failedJob = await executeDossierJob(job.id, {
      jobRepo,
      dossierRepo,
      pipelineFn: failingPipeline,
    });

    expect(failedJob?.status).toBe(JOB_STATUS.FAILED);
    expect(failedJob?.errorMessage).toContain('Anthropic API 500');
    expect(failedJob?.retryCount).toBe(1);
  });
});
