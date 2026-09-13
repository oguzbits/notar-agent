import { z } from 'zod';
import { CaseType, AnalyzeRequestSchema } from './dossier';

export const JOB_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export const JobStatusSchema = z.enum([
  JOB_STATUS.PENDING,
  JOB_STATUS.PROCESSING,
  JOB_STATUS.COMPLETED,
  JOB_STATUS.FAILED,
]);

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const JOB_STAGES = {
  QUEUED: 'QUEUED',
  PAGE_SPLITTING: 'PAGE_SPLITTING',
  EXTRACTION: 'EXTRACTION',
  AUDITING: 'AUDITING',
  PERSISTING: 'PERSISTING',
} as const;

export const JobStageSchema = z.enum([
  JOB_STAGES.QUEUED,
  JOB_STAGES.PAGE_SPLITTING,
  JOB_STAGES.EXTRACTION,
  JOB_STAGES.AUDITING,
  JOB_STAGES.PERSISTING,
]);

export type JobStage = (typeof JOB_STAGES)[keyof typeof JOB_STAGES];

/**
 * Der Job-Eingabepayload entspricht exakt dem validierten Ingestion-Request.
 * Vermeidet Duplizierung von Schemadateien.
 */
export const CreateJobPayloadSchema = AnalyzeRequestSchema;
export type CreateJobPayload = z.infer<typeof CreateJobPayloadSchema>;

export const DossierJobSchema = z.object({
  id: z.string().describe('Eindeutige Job-ID (UUID oder nanoid)'),
  status: JobStatusSchema.describe('Aktueller Verarbeitungsstatus des Jobs'),
  stage: JobStageSchema.optional().describe('Detaillierter Teilschritt während PROCESSING'),
  progressPercent: z.number().min(0).max(100).default(0).describe('Fortschritt in Prozent (0-100)'),
  payload: CreateJobPayloadSchema.describe('Eingabedaten für den Analyse-Lauf (inkl. caseType)'),
  resultDossierId: z.string().optional().describe('ID des erzeugten Dossiers nach Abschluss'),
  errorMessage: z.string().optional().describe('Fehlermeldung bei Status FAILED'),
  retryCount: z.number().nonnegative().default(0),
  maxRetries: z.number().nonnegative().default(3),
  createdAt: z.string().describe('Erstellungszeitpunkt (ISO UTC)'),
  updatedAt: z.string().describe('Letzte Aktualisierung (ISO UTC)'),
});

export type DossierJob = z.infer<typeof DossierJobSchema>;

/**
 * Bequemer Helper-Getter für den Vorgangstyp ohne doppelte Speicherung im Root-Objekt.
 */
export function getJobCaseType(job: DossierJob): CaseType {
  return job.payload.caseType;
}
