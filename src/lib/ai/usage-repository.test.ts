import { describe, it, expect, vi } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { LLM_USAGE_STAGES } from '@/types/llm-usage';
import { SupabaseLlmUsageRepository } from './usage-repository';

const entry = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  jobId: 'job-1',
  stage: LLM_USAGE_STAGES.AUDIT,
  model: 'm',
  inputTokens: 10,
  outputTokens: 5,
} as const;

describe('SupabaseLlmUsageRepository', () => {
  it('schreibt den Verbrauch in llm_usage', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    await new SupabaseLlmUsageRepository({ from } as never).record(entry);
    expect(from).toHaveBeenCalledWith(DB_TABLES.LLM_USAGE);
    expect(insert).toHaveBeenCalledWith({
      organization_id: entry.organizationId,
      job_id: 'job-1',
      stage: LLM_USAGE_STAGES.AUDIT,
      model: 'm',
      input_tokens: 10,
      output_tokens: 5,
    });
  });

  it('wirft bei Datenbankfehler (Fail-Fast)', async () => {
    const from = vi
      .fn()
      .mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: 'x' } }) });
    await expect(new SupabaseLlmUsageRepository({ from } as never).record(entry)).rejects.toThrow(
      'Supabase recordLlmUsage fehlgeschlagen: x'
    );
  });

  it('lehnt negative Tokenzahlen ab', async () => {
    const from = vi.fn();
    await expect(
      new SupabaseLlmUsageRepository({ from } as never).record({ ...entry, inputTokens: -1 })
    ).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});
