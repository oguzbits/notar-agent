import { describe, it, expect, vi } from 'vitest';
import { DB_TABLES } from '@/types/database';
import { LLM_USAGE_STAGES } from '@/types/llm-usage';
import {
  createUsageRecorder,
  ILlmUsageRepository,
  SupabaseLlmUsageRepository,
} from './usage-repository';

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

describe('createUsageRecorder', () => {
  const usage = { stage: LLM_USAGE_STAGES.EXTRACTION, model: 'm', inputTokens: 1, outputTokens: 1 };

  it('ohne Job-ID trägt jeder Live-Lauf eine eigene Lauf-ID, damit er im Kontingent zählt', () => {
    const record = vi.fn<ILlmUsageRepository['record']>().mockResolvedValue();
    const firstRun = createUsageRecorder({ record }, entry.organizationId);
    firstRun(usage);
    firstRun(usage);
    createUsageRecorder({ record }, entry.organizationId)(usage);

    const ids = record.mock.calls.map(([e]) => e.jobId);
    expect(ids[0]).toMatch(/^live:/);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it('übernimmt die Job-ID eines Hintergrund-Jobs', () => {
    const record = vi.fn<ILlmUsageRepository['record']>().mockResolvedValue();
    createUsageRecorder({ record }, entry.organizationId, 'job-1')(usage);
    expect(record.mock.calls[0]?.[0].jobId).toBe('job-1');
  });
});
