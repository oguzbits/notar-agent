import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import type { LanguageModel, SystemModelMessage } from 'ai';
import { validateEnv } from '@/env';
import {
  IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
  NOTARY_AUDITOR_RECONCILER_PROMPT,
} from '@/lib/ai/prompts';

export interface AiConfiguration {
  model: LanguageModel;
  extractionInstructions: SystemModelMessage;
  auditorInstructions: SystemModelMessage;
}

export function getAiConfiguration(): AiConfiguration {
  const env = validateEnv(process.env);
  const geminiKey = env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;

  if (!geminiKey && !anthropicKey) {
    throw new Error(
      'Kein KI-API-Key konfiguriert. Bitte hinterlege GEMINI_API_KEY oder ANTHROPIC_API_KEY in deiner .env.local.'
    );
  }

  const useGemini = Boolean(geminiKey && (!anthropicKey || env.AI_PROVIDER === 'google'));

  if (useGemini && geminiKey) {
    const google = createGoogle({
      apiKey: geminiKey,
    });
    const modelName =
      env.AI_MODEL && !env.AI_MODEL.startsWith('claude') ? env.AI_MODEL : 'gemini-3.5-flash-lite';
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
  const modelName = env.AI_MODEL || 'claude-haiku-4-5';

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
