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
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const env = validateEnv(process.env);
    expect(env.AI_MODEL).toBe('claude-haiku-4-5');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it('correctly reads and trims configured environment variables', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-123';
    process.env.AI_MODEL = 'claude-sonnet-5';
    process.env.AI_PROVIDER = 'anthropic';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb-anon-key';

    const env = validateEnv(process.env);
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-test-123');
    expect(env.AI_MODEL).toBe('claude-sonnet-5');
    expect(env.AI_PROVIDER).toBe('anthropic');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('sb-anon-key');
  });

  it('falls back to SUPABASE_URL if NEXT_PUBLIC_SUPABASE_URL is not set', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://fallback.supabase.co';

    const env = validateEnv(process.env);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://fallback.supabase.co');
  });

  it('exposes getEnv singleton function', () => {
    const env = getEnv();
    expect(typeof env).toBe('object');
    expect(env).toBeDefined();
  });
});
