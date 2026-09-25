import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import type { LanguageModel, SystemModelMessage } from 'ai';
import { validateEnv } from '@/env';
import {
  IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
  NOTARY_AUDITOR_RECONCILER_PROMPT,
} from '@/lib/ai/prompts';
import { SSO_PROVIDERS } from '@/types/auth';

export interface AIModelProviderResult {
  model: LanguageModel;
  extractionInstructions: SystemModelMessage;
  auditorInstructions: SystemModelMessage;
}

export function getAiConfiguration(): AIModelProviderResult {
  const env = validateEnv(process.env);
  const geminiKey = env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  if (env.MOCK_AI) {
    return {
      model: {} as LanguageModel,
      extractionInstructions: { role: 'system', content: '' },
      auditorInstructions: { role: 'system', content: '' },
    };
  }

  if (!geminiKey && !anthropicKey) {
    throw new Error(
      'Kein KI-API-Key konfiguriert. Bitte hinterlege GEMINI_API_KEY oder ANTHROPIC_API_KEY in deiner .env.local.'
    );
  }

  const modelName = env.AI_MODEL;
  if (!modelName) {
    throw new Error('Kein KI-Modell konfiguriert. Bitte hinterlege AI_MODEL in deiner .env.local.');
  }

  const useGemini = Boolean(
    geminiKey && (!anthropicKey || env.AI_PROVIDER === SSO_PROVIDERS.GOOGLE)
  );

  if (useGemini && geminiKey) {
    const google = createGoogle({
      apiKey: geminiKey,
    });
    return {
      model: google(modelName),
      extractionInstructions: {
        role: 'system',
        content: IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
      },
      auditorInstructions: {
        role: 'system',
        content: NOTARY_AUDITOR_RECONCILER_PROMPT,
      },
    };
  }

  const anthropic = createAnthropic({
    apiKey: anthropicKey,
  });

  return {
    model: anthropic(modelName),
    extractionInstructions: {
      role: 'system',
      content: IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      },
    },
    auditorInstructions: {
      role: 'system',
      content: NOTARY_AUDITOR_RECONCILER_PROMPT,
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      },
    },
  };
}
