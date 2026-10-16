import { cleanAndParseJson } from '@/lib/ai/parsers/clean-json';
import { logFailure } from '@/lib/observability/logger';
import { OVERALL_STATUS, OverallStatus } from '@/types/dossier';
import { AuditorStageOutputSchema } from '@/types/pipeline';

/**
 * Parst die Auditor-Antwort. Unlesbare oder schemawidrige Ausgaben werden als Fehlschlag markiert,
 * damit der Vorgang fail-closed nie als freigegeben gilt.
 */
export function parseAuditorOutput(text: string): {
  parsedAuditorRaw: Record<string, unknown>;
  failClosedStatus?: OverallStatus;
} {
  let raw: Record<string, unknown> = {};
  let auditorFailed = false;
  try {
    raw = cleanAndParseJson<Record<string, unknown>>(text);
  } catch (err: unknown) {
    logFailure('warn', 'auditor_json_parse_fehler', err);
    auditorFailed = true;
  }
  const validated = AuditorStageOutputSchema.safeParse(raw);
  if (!validated.success) auditorFailed = true;
  return {
    parsedAuditorRaw: validated.success ? validated.data : raw,
    failClosedStatus: auditorFailed ? OVERALL_STATUS.ACTION_REQUIRED : undefined,
  };
}
