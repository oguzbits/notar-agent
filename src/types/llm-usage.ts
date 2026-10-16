import { z } from 'zod';

export const LLM_USAGE_STAGES = { EXTRACTION: 'extraktion', AUDIT: 'pruefung' } as const;

/** Token-Verbrauch eines einzelnen Modellaufrufs; Kosten entstehen erst in der View `llm_usage_costs`. */
export const LlmUsageEntrySchema = z
  .object({
    organizationId: z.string().uuid(),
    jobId: z.string().optional(),
    stage: z.enum([LLM_USAGE_STAGES.EXTRACTION, LLM_USAGE_STAGES.AUDIT]),
    model: z.string().min(1),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  })
  .strict();

export type LlmUsageEntry = z.infer<typeof LlmUsageEntrySchema>;

/** Verbrauch je Modellaufruf; der Aufrufer entscheidet, wohin er geschrieben wird. */
export type StageUsageHandler = (usage: Omit<LlmUsageEntry, 'organizationId' | 'jobId'>) => void;
