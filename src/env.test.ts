import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEnv, validateEnv } from './env';

describe('env validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('validates default environment gracefully when variables are absent', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.AI_MODEL;
    delete process.env.AI_PROVIDER;
    delete process.env.NEXT_SUPABASE_URL;
    delete process.env.NEXT_SUPABASE_PUBLISHABLE_KEY;

    const env = validateEnv(process.env);
    expect(env.AI_MODEL).toBe('claude-haiku-5-5');
    expect(env.GEMINI_PARSE_MODEL).toBe('gemini-3.1-flash-lite');
    expect(env.GEMINI_PARSE_FALLBACK_MODEL).toBe('gemini-3.5-flash-lite');
    expect(env.MOCK_AI).toBe(false);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.NEXT_SUPABASE_URL).toBeUndefined();
  });

  it('correctly reads and trims configured environment variables', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-123';
    process.env.AI_MODEL = 'claude-sonnet-5';
    process.env.AI_PROVIDER = 'anthropic';
    process.env.MOCK_AI = 'true';
    process.env.NEXT_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_SUPABASE_PUBLISHABLE_KEY = 'sb-anon-key';

    const env = validateEnv(process.env);
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-test-123');
    expect(env.AI_MODEL).toBe('claude-sonnet-5');
    expect(env.AI_PROVIDER).toBe('anthropic');
    expect(env.MOCK_AI).toBe(true);
    expect(env.NEXT_SUPABASE_URL).toBe('https://example.supabase.co');
    expect(env.NEXT_SUPABASE_PUBLISHABLE_KEY).toBe('sb-anon-key');
  });

  it('exposes getEnv singleton function', () => {
    const env = getEnv();
    expect(typeof env).toBe('object');
    expect(env).toBeDefined();
  });
});
