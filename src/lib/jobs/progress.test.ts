import { describe, it, expect } from 'vitest';
import { CASE_TYPES } from '@/types/dossier';
import { JOB_STATUS, DossierJobSchema } from '@/types/jobs';
import { getJobCaseType, computeJobProgressPercent } from './progress';

describe('Job Progress & CaseType Logic (progress.ts)', () => {
  it('ermittelt den Vorgangstyp aus dem Job-Payload', () => {
    const job = DossierJobSchema.parse({
      id: 'job-1',
      status: JOB_STATUS.PROCESSING,
      payload: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: 'Initialer Vorgang',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(getJobCaseType(job)).toBe(CASE_TYPES.IMMOBILIENKAUF);
  });

  it('berechnet 100% Fortschritt wenn Status COMPLETED ist', () => {
    expect(computeJobProgressPercent({ status: JOB_STATUS.COMPLETED })).toBe(100);
  });

  it('berechnet 0% Fortschritt wenn Status PENDING oder FAILED ist', () => {
    expect(computeJobProgressPercent({ status: JOB_STATUS.PENDING })).toBe(0);
    expect(computeJobProgressPercent({ status: JOB_STATUS.FAILED })).toBe(0);
  });

  it('berechnet relativen Fortschritt anhand processedUnits und totalUnits', () => {
    const job = {
      status: JOB_STATUS.PROCESSING,
      progressDetails: {
        currentStep: 1,
        totalSteps: 3,
        processedUnits: 3,
        totalUnits: 10,
      },
    };
    expect(computeJobProgressPercent(job)).toBe(30);
  });

  it('berechnet relativen Fortschritt anhand currentStep und totalSteps falls keine Units vorhanden', () => {
    const job = {
      status: JOB_STATUS.PROCESSING,
      progressDetails: {
        currentStep: 2,
        totalSteps: 4,
      },
    };
    expect(computeJobProgressPercent(job)).toBe(50);
  });
});
