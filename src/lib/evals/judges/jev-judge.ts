import { JudgeVerdict, JUDGE_VERDICT_STATUS } from '@/types/eval';
import { DeterministicJudge } from './deterministic-judge';
import { IEvalJudge, JudgeEvaluateParams } from './judge-interface';

export interface JevDecisionResponse {
  choice:
    | typeof JUDGE_VERDICT_STATUS.PASS
    | typeof JUDGE_VERDICT_STATUS.FAIL
    | typeof JUDGE_VERDICT_STATUS.NEEDS_REVIEW;
  score: number;
  confidence: number;
  reason: string;
}

export interface IJevClient {
  decide(promptPayload: {
    question: string;
    context: Record<string, unknown>;
  }): Promise<JevDecisionResponse>;
}

export interface JevJudgeOptions {
  apiKey?: string;
  client?: IJevClient;
  fallbackJudge?: IEvalJudge;
}

/**
 * Adapter für TypeSafe AI Jev (System-1 Decision Model).
 * Liefert strukturierte, nicht-autoregressive Beurteilungen mit hoher Geschwindigkeit und minimalen Tokenkosten.
 * Wenn kein API-Key oder Client vorliegt, wird transparent der DeterministicJudge als Fallback genutzt.
 */
export class JevJudge implements IEvalJudge {
  private apiKey?: string;
  private client?: IJevClient;
  private fallbackJudge: IEvalJudge;

  constructor(options: JevJudgeOptions = {}) {
    this.apiKey = options.apiKey || process.env.JEV_API_KEY;
    this.client = options.client;
    this.fallbackJudge = options.fallbackJudge || new DeterministicJudge();
  }

  async evaluate(params: JudgeEvaluateParams): Promise<JudgeVerdict> {
    // Wenn kein Client und kein API-Key hinterlegt sind, greift der sichere deterministische Fallback
    if (!this.client && !this.apiKey) {
      const fallbackResult = await this.fallbackJudge.evaluate(params);
      return {
        ...fallbackResult,
        reason: `[Deterministischer Fallback (Kein Jev-Key konfiguriert)]: ${fallbackResult.reason}`,
      };
    }

    try {
      if (this.client) {
        const response = await this.client.decide({
          question: `Stimmt der extrahierte Notarwert für "${params.fieldKey}" mit dem erwarteten Wert überein?`,
          context: {
            fieldKey: params.fieldKey,
            expected: params.expected,
            actual: params.actual,
            criteria: params.criteria || 'Juristische und inhaltliche Äquivalenz',
          },
        });

        return {
          status: response.choice,
          score: response.score,
          matched: response.choice === JUDGE_VERDICT_STATUS.PASS && response.score >= 0.8,
          confidence: response.confidence,
          reason: `[Jev System-1]: ${response.reason}`,
        };
      }

      // HTTP-Call an TypeSafe AI Jev Endpoint, falls apiKey gesetzt ist
      const response = await fetch('https://api.typesafe.ai/v1/decide', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'jev-1',
          question: `Stimmt der extrahierte Wert für "${params.fieldKey}" juristisch überein?`,
          context: {
            expected: params.expected,
            actual: params.actual,
          },
          returnType: 'ChoiceAndScore',
        }),
      });

      if (!response.ok) {
        throw new Error(`Jev API Error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as JevDecisionResponse;
      return {
        status: data.choice,
        score: data.score,
        matched: data.choice === JUDGE_VERDICT_STATUS.PASS,
        confidence: data.confidence ?? 1.0,
        reason: `[Jev Live]: ${data.reason}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const fallbackResult = await this.fallbackJudge.evaluate(params);
      return {
        ...fallbackResult,
        reason: `[Jev Fehler -> Fallback aktiviert (${msg})]: ${fallbackResult.reason}`,
      };
    }
  }
}
