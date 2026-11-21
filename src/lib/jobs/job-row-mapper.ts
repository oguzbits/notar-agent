import {
  CreateJobPayload,
  DossierJob,
  JobProgressDetails,
  JobStage,
  JobStatus,
} from '@/types/jobs';

const optionalString = (value: unknown): string | undefined => (value ? String(value) : undefined);

/** Übersicht ohne Dateiinhalte: nur Name, Größe, Typ und Kodierung je Datei. */
function stripFileContents(payload: CreateJobPayload): CreateJobPayload {
  return {
    ...payload,
    files: (payload.files || []).map(({ name, size, type, isBase64 }) => ({
      name,
      size,
      type,
      isBase64,
    })),
  };
}

export function mapRowToJob(
  row: Record<string, unknown>,
  options?: { lightweight?: boolean }
): DossierJob {
  const rawPayload = row.payload as CreateJobPayload | undefined;
  const payload =
    options?.lightweight && rawPayload
      ? stripFileContents(rawPayload)
      : (rawPayload as CreateJobPayload);

  return {
    id: String(row.id),
    organizationId: optionalString(row.organization_id),
    status: row.status as JobStatus,
    stage: optionalString(row.stage) as JobStage | undefined,
    progressDetails: row.progress_details
      ? (row.progress_details as JobProgressDetails)
      : undefined,
    payload,
    resultDossierId: optionalString(row.result_dossier_id),
    errorMessage: optionalString(row.error_message),
    retryCount: Number(row.retry_count ?? 0),
    maxRetries: Number(row.max_retries ?? 3),
    lockedAt: optionalString(row.locked_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
