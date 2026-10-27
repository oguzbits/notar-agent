import { SupabaseClient } from '@supabase/supabase-js';
import { logFailure } from '@/lib/observability/logger';
import { DB_TABLES, Database } from '@/types/database';
import { LlmUsageEntry, LlmUsageEntrySchema, StageUsageHandler } from '@/types/llm-usage';

export interface ILlmUsageRepository {
  record(entry: LlmUsageEntry): Promise<void>;
}

export class SupabaseLlmUsageRepository implements ILlmUsageRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async record(entry: LlmUsageEntry): Promise<void> {
    const e = LlmUsageEntrySchema.parse(entry);
    const { error } = await this.supabase.from(DB_TABLES.LLM_USAGE).insert({
      organization_id: e.organizationId,
      job_id: e.jobId ?? null,
      stage: e.stage,
      model: e.model,
      input_tokens: e.inputTokens,
      output_tokens: e.outputTokens,
    });
    if (error) throw new Error(`Supabase recordLlmUsage fehlgeschlagen: ${error.message}`);
  }
}

/**
 * Erfassung darf eine Analyse nie scheitern lassen: Fehler werden nur protokolliert.
 * Ohne Job (Live-Lauf) erhält der Lauf eine eigene ID, über die ihn das Stundenkontingent zählt.
 */
export function createUsageRecorder(
  repo: ILlmUsageRepository,
  organizationId: string,
  jobId = `live:${crypto.randomUUID()}`
): StageUsageHandler {
  return (usage) => {
    repo.record({ organizationId, jobId, ...usage }).catch((err: unknown) => {
      logFailure('error', 'llm_usage_erfassung_fehlgeschlagen', err);
    });
  };
}
