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

export const PROGRESS_UNIT_LABELS = {
  PAGES: 'PAGES',
  DOCUMENTS: 'DOCUMENTS',
  FIELDS: 'FIELDS',
} as const;

export const ProgressUnitLabelSchema = z.enum([
  PROGRESS_UNIT_LABELS.PAGES,
  PROGRESS_UNIT_LABELS.DOCUMENTS,
  PROGRESS_UNIT_LABELS.FIELDS,
]);

export type ProgressUnitLabel = (typeof PROGRESS_UNIT_LABELS)[keyof typeof PROGRESS_UNIT_LABELS];

/**
 * Strukturierte, deterministische Fortschritts-Details (Work Units & Live-Aktivität)
 * nach modernem Enterprise-Standard (statt reiner Schätz-Prozente).
 */
export const JobProgressDetailsSchema = z.object({
  currentStep: z.number().int().min(1).describe('Aktueller diskreter Schritt (z. B. 1 von 4)'),
  totalSteps: z.number().int().min(1).describe('Gesamtanzahl diskreter Schritte'),
  processedUnits: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Zahl bearbeiteter Einheiten (z. B. 3 Seiten)'),
  totalUnits: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Gesamtzahl Einheiten (z. B. 12 Seiten)'),
  unitLabel: ProgressUnitLabelSchema.optional().describe('Art der verarbeiteten Einheiten'),
  currentActivity: z
    .string()
    .optional()
    .describe('Menschlich lesbarer Mikrostext zur aktuellen Aktivität'),
});

export type JobProgressDetails = z.infer<typeof JobProgressDetailsSchema>;

export const DossierJobSchema = z.object({
  id: z.string().describe('Eindeutige Job-ID (UUID oder nanoid)'),
  status: JobStatusSchema.describe('Aktueller Verarbeitungsstatus des Jobs'),
  stage: JobStageSchema.optional().describe('Detaillierter Teilschritt während PROCESSING'),
  progressDetails: JobProgressDetailsSchema.optional().describe(
    'Deterministische Work Units & Live-Aktivität (Single Source of Truth)'
  ),
  payload: CreateJobPayloadSchema.describe('Eingabedaten für den Analyse-Lauf (inkl. caseType)'),
  resultDossierId: z.string().optional().describe('ID des erzeugten Dossiers nach Abschluss'),
  errorMessage: z.string().optional().describe('Fehlermeldung bei Status FAILED'),
  retryCount: z.number().nonnegative().default(0),
  maxRetries: z.number().nonnegative().default(3),
  lockedAt: z
    .string()
    .optional()
    .describe('Zeitpunkt der Lease-Sperrung durch einen Worker (ISO UTC) für Orphan-Detection'),
  createdAt: z.string().describe('Erstellungszeitpunkt (ISO UTC)'),
  updatedAt: z.string().describe('Letzte Aktualisierung (ISO UTC)'),
});

export const RetryJobRequestSchema = z.object({
  jobId: z.string().min(1, 'Parameter "jobId" fehlt oder ist leer.'),
});

export type RetryJobRequest = z.infer<typeof RetryJobRequestSchema>;

export type DossierJob = z.infer<typeof DossierJobSchema>;

/**
 * Bequemer Helper-Getter für den Vorgangstyp ohne doppelte Speicherung im Root-Objekt.
 */
export function getJobCaseType(job: DossierJob): CaseType {
  return job.payload.caseType;
}

/**
 * Berechnet den Fortschritt in Prozent (0-100) rein abgeleitet (Derived State)
 * aus progressDetails für A11y (aria-valuenow) und Ladebalken.
 * Verhindert redundanten State und Inkonsistenzen im Datenmodell.
 */
export function computeJobProgressPercent(
  job: Pick<DossierJob, 'status' | 'progressDetails'>
): number {
  if (job.status === JOB_STATUS.COMPLETED) return 100;
  if (
    job.status === JOB_STATUS.PENDING ||
    job.status === JOB_STATUS.FAILED ||
    !job.progressDetails
  ) {
    return 0;
  }

  const { currentStep, totalSteps, processedUnits, totalUnits } = job.progressDetails;

  if (totalUnits && totalUnits > 0 && processedUnits !== undefined) {
    return Math.min(100, Math.max(0, Math.round((processedUnits / totalUnits) * 100)));
  }

  if (totalSteps > 0) {
    return Math.min(100, Math.max(0, Math.round((currentStep / totalSteps) * 100)));
  }

  return 0;
}
