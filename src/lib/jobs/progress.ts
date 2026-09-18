import { CaseType } from '@/types/dossier';
import { DossierJob, JOB_STATUS } from '@/types/jobs';

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

  if (totalSteps && totalSteps > 0 && currentStep !== undefined) {
    return Math.min(100, Math.max(0, Math.round((currentStep / totalSteps) * 100)));
  }

  return 0;
}
