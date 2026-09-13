import { describe, it, expect } from 'vitest';
import { CASE_TYPES } from './dossier';
import {
  JOB_STATUS,
  JobStatusSchema,
  JOB_STAGES,
  JobStageSchema,
  PROGRESS_UNIT_LABELS,
  DossierJobSchema,
  CreateJobPayloadSchema,
  getJobCaseType,
  computeJobProgressPercent,
} from './jobs';

describe('Job Queue Lifecycle Schemas (Phase B.1)', () => {
  it('should validate JOB_STATUS dictionary and schema', () => {
    expect(JobStatusSchema.safeParse(JOB_STATUS.PENDING).success).toBe(true);
    expect(JobStatusSchema.safeParse(JOB_STATUS.PROCESSING).success).toBe(true);
    expect(JobStatusSchema.safeParse(JOB_STATUS.COMPLETED).success).toBe(true);
    expect(JobStatusSchema.safeParse(JOB_STATUS.FAILED).success).toBe(true);
    expect(JobStatusSchema.safeParse('UNKNOWN_STATUS').success).toBe(false);
  });

  it('should validate JOB_STAGES schema for live progress', () => {
    expect(JobStageSchema.safeParse(JOB_STAGES.QUEUED).success).toBe(true);
    expect(JobStageSchema.safeParse(JOB_STAGES.PAGE_SPLITTING).success).toBe(true);
    expect(JobStageSchema.safeParse(JOB_STAGES.EXTRACTION).success).toBe(true);
    expect(JobStageSchema.safeParse(JOB_STAGES.AUDITING).success).toBe(true);
    expect(JobStageSchema.safeParse(JOB_STAGES.PERSISTING).success).toBe(true);
    expect(JobStageSchema.safeParse('INVALID_STAGE').success).toBe(false);
  });

  it('should parse valid CreateJobPayloadSchema', () => {
    const validPayload = {
      caseType: CASE_TYPES.IMMOBILIENKAUF,
      files: [{ name: 'Kaufvertrag.pdf', type: 'application/pdf', size: 1024 }],
      notes: 'Wichtige Vorbemerkung',
    };
    const result = CreateJobPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('should parse full DossierJob record and compute derived progress percent', () => {
    const jobRecord = {
      id: 'job-123456',
      status: JOB_STATUS.PROCESSING,
      stage: JOB_STAGES.EXTRACTION,
      progressDetails: {
        currentStep: 2,
        totalSteps: 4,
        processedUnits: 2,
        totalUnits: 5,
        unitLabel: PROGRESS_UNIT_LABELS.DOCUMENTS,
        currentActivity: 'Extraktion läuft...',
      },
      payload: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [{ name: 'Kaufvertrag.pdf', type: 'application/pdf', size: 1024 }],
        notes: '',
      },
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = DossierJobSchema.safeParse(jobRecord);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(getJobCaseType(result.data)).toBe(CASE_TYPES.IMMOBILIENKAUF);
      expect(result.data.progressDetails?.processedUnits).toBe(2);
      // 2 von 5 Einheiten = 40 %
      expect(computeJobProgressPercent(result.data)).toBe(40);
    }
  });

  it('should validate failed job with error message and compute 0% progress', () => {
    const failedJob = {
      id: 'job-err-789',
      status: JOB_STATUS.FAILED,
      payload: {
        caseType: CASE_TYPES.IMMOBILIENKAUF,
        files: [],
        notes: 'Nachprüfung',
      },
      errorMessage: 'PDF konnte nicht dekodiert werden.',
      retryCount: 3,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = DossierJobSchema.safeParse(failedJob);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errorMessage).toBe('PDF konnte nicht dekodiert werden.');
      expect(getJobCaseType(result.data)).toBe(CASE_TYPES.IMMOBILIENKAUF);
      expect(computeJobProgressPercent(result.data)).toBe(0);
    }
  });
});
