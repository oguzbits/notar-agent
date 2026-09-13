import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAiConfiguration } from './ai-provider';

describe('ai-provider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MOCK_AI;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns empty mock configuration when MOCK_AI=true', () => {
    process.env.MOCK_AI = 'true';
    const config = getAiConfiguration();

    expect(config.extractionInstructions.role).toBe('system');
    expect(config.extractionInstructions.content).toBe('');
    expect(config.auditorInstructions.content).toBe('');
  });

  it('throws an error when neither GEMINI_API_KEY nor ANTHROPIC_API_KEY is configured', () => {
    expect(() => getAiConfiguration()).toThrowError(/Kein KI-API-Key konfiguriert/i);
  });

  it('initializes Google Gemini provider when GEMINI_API_KEY is present', () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key-123';
    process.env.AI_PROVIDER = 'google';

    const config = getAiConfiguration();

    expect(config.model).toBeDefined();
    expect(config.extractionInstructions.role).toBe('system');
    expect(config.extractionInstructions.content).toContain('Notariat');
    expect(config.auditorInstructions.role).toBe('system');
    expect(config.auditorInstructions.content).toContain('Qualitätssicherungsinstanz');
  });

  it('initializes Anthropic provider when ANTHROPIC_API_KEY is present and AI_PROVIDER is anthropic', () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key-456';
    process.env.AI_PROVIDER = 'anthropic';

    const config = getAiConfiguration();

    expect(config.model).toBeDefined();
    expect(config.extractionInstructions.role).toBe('system');
    expect(config.extractionInstructions.content).toContain('Notariat');
    expect(config.auditorInstructions.role).toBe('system');
    // Prompt-Caching providerOptions
    expect(config.extractionInstructions.providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    });
  });
});
