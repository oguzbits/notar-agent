import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { runAnalysisPipeline } from '@/lib/ai/pipeline';
import {
  IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
  NOTARY_AUDITOR_RECONCILER_PROMPT,
} from '@/lib/ai/prompts';
import { GOLDEN_DATASET } from '@/test/eval/golden-dataset';
import { createMockEvalModel } from '@/test/eval/mock-eval-model';

interface PromptfooCallContext {
  vars: {
    testCaseId: string;
    mode?: 'live' | 'mock';
  };
}

interface PromptfooProviderResponse {
  output?: string;
  error?: string;
  tokenUsage?: {
    total: number;
    prompt: number;
    completion: number;
  };
  cost?: number;
}

/**
 * Schlanker Custom Provider für Promptfoo.
 * Führt die NotarPartner-Pipeline aus und liefert Dossier-JSON, Token-Usage und Kosten.
 * Unterstützt sowohl Google Gemini als auch Anthropic Claude für Live-Runs.
 */
export default class NotarPartnerPipelineProvider {
  private customId: string;

  constructor(options: { id?: string } = {}) {
    this.customId = options.id || 'notar-partner-agentic-pipeline';
  }

  id(): string {
    return this.customId;
  }

  async callApi(
    _prompt: string,
    context: PromptfooCallContext
  ): Promise<PromptfooProviderResponse> {
    const testCaseId = context?.vars?.testCaseId;
    if (!testCaseId) {
      return { error: 'testCaseId fehlt in context.vars' };
    }

    const testCase = GOLDEN_DATASET.find((tc) => tc.id === testCaseId);
    if (!testCase) {
      return { error: `Testfall "${testCaseId}" nicht im GOLDEN_DATASET gefunden.` };
    }

    const isLive = context?.vars?.mode === 'live' || process.env.PROMPTFOO_MODE === 'live';
    let model: LanguageModel;
    let isAnthropic = false;

    let tokenUsage = {
      prompt: isLive ? 0 : 700,
      completion: isLive ? 0 : 350,
      total: isLive ? 0 : 1050,
    };

    if (isLive) {
      const anthropicKey = process.env.EVAL_ANTHROPIC_API_KEY;
      const geminiKey = process.env.EVAL_GEMINI_API_KEY;

      if (!anthropicKey && !geminiKey) {
        return {
          error:
            'Weder EVAL_ANTHROPIC_API_KEY noch EVAL_GEMINI_API_KEY ist gesetzt. Bitte mindestens einen Key in .env.local eintragen.',
        };
      }

      isAnthropic = Boolean(anthropicKey);

      if (isAnthropic && anthropicKey) {
        const modelName = process.env.EVAL_ANTHROPIC_AI_MODEL || 'claude-3-5-haiku-20241022';
        const anthropic = createAnthropic({ apiKey: anthropicKey });
        model = anthropic(modelName);
      } else {
        if (!geminiKey) {
          return {
            error: 'EVAL_GEMINI_API_KEY nicht gesetzt. Bitte in .env.local eintragen.',
          };
        }
        const modelName = process.env.EVAL_GEMINI_AI_MODEL || 'gemini-3.8-flash';
        const google = createGoogle({ apiKey: geminiKey });
        model = google(modelName);
      }
    } else {
      model = createMockEvalModel(testCase);
    }

    try {
      const dossier = await runAnalysisPipeline({
        files: testCase.files,
        caseType: testCase.caseType,
        notes: testCase.notes,
        model,
        extractionInstructions: {
          role: 'system',
          content: IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
        },
        auditorInstructions: {
          role: 'system',
          content: NOTARY_AUDITOR_RECONCILER_PROMPT,
        },
        onStep: () => {},
        onUsage: (usage) => {
          tokenUsage = {
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens,
          };
        },
      });

      // Pricing: Gemini 3.8 Flash ($0.075 / $0.30), Claude 3.5 Haiku ($0.80 / $4.00) pro 1M Tokens
      const inputCostPerMillion = isAnthropic ? 0.8 : 0.075;
      const outputCostPerMillion = isAnthropic ? 4.0 : 0.3;
      const cost =
        (tokenUsage.prompt / 1_000_000) * inputCostPerMillion +
        (tokenUsage.completion / 1_000_000) * outputCostPerMillion;

      return {
        output: JSON.stringify(dossier),
        tokenUsage,
        cost,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `Pipeline-Fehler: ${msg}` };
    }
  }
}
