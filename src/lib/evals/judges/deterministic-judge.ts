import { JUDGE_VERDICT_STATUS, JudgeVerdict } from '@/types/eval';
import { IEvalJudge, JudgeEvaluateParams } from './judge-interface';

/**
 * Deterministischer Judge für Layer 1/3:
 * Vergleicht Zahlen, Strings, Datumsangaben und Objekte ohne externe Modellaufrufe.
 */
export class DeterministicJudge implements IEvalJudge {
  async evaluate(params: JudgeEvaluateParams): Promise<JudgeVerdict> {
    const { expected, actual } = params;

    if (expected === actual) {
      return {
        status: JUDGE_VERDICT_STATUS.PASS,
        score: 1.0,
        matched: true,
        confidence: 1.0,
        reason: 'Exakte Identität der Werte',
      };
    }

    if (typeof expected === 'number' && typeof actual === 'number') {
      const diff = Math.abs(expected - actual);
      const isClose = diff < 0.001;
      return {
        status: isClose ? JUDGE_VERDICT_STATUS.PASS : JUDGE_VERDICT_STATUS.FAIL,
        score: isClose ? 1.0 : 0.0,
        matched: isClose,
        confidence: 1.0,
        reason: isClose
          ? 'Numerische Übereinstimmung'
          : `Numerische Abweichung: erwartet ${expected}, erhalten ${actual}`,
      };
    }

    if (typeof expected === 'string' && typeof actual === 'string') {
      const clean = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/^(?:herr|frau)\s+/i, '');

      const isMatch = clean(expected) === clean(actual);
      return {
        status: isMatch ? JUDGE_VERDICT_STATUS.PASS : JUDGE_VERDICT_STATUS.FAIL,
        score: isMatch ? 1.0 : 0.0,
        matched: isMatch,
        confidence: 1.0,
        reason: isMatch
          ? 'String-Übereinstimmung (normalisiert)'
          : `Text-Abweichung: erwartet "${expected}", erhalten "${actual}"`,
      };
    }

    if (
      typeof expected === 'object' &&
      expected !== null &&
      typeof actual === 'object' &&
      actual !== null
    ) {
      const isJsonMatch = JSON.stringify(expected) === JSON.stringify(actual);
      return {
        status: isJsonMatch ? JUDGE_VERDICT_STATUS.PASS : JUDGE_VERDICT_STATUS.FAIL,
        score: isJsonMatch ? 1.0 : 0.0,
        matched: isJsonMatch,
        confidence: 1.0,
        reason: isJsonMatch
          ? 'Objektstrukturen identisch'
          : 'Objektstrukturen weichen voneinander ab',
      };
    }

    return {
      status: JUDGE_VERDICT_STATUS.FAIL,
      score: 0.0,
      matched: false,
      confidence: 1.0,
      reason: `Nicht übereinstimmende Typen oder Werte (Erwartet: ${String(expected)}, Erhalten: ${String(actual)})`,
    };
  }
}
