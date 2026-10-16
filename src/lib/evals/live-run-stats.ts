import {
  LIVE_EVAL_GATE,
  type EvalRun,
  type FieldErrorRate,
  type LiveEvalGateResult,
} from '@/types/eval';

const HTTP_TOO_MANY_REQUESTS = 429;
const QUOTA_MESSAGE_PATTERN = /resource_exhausted|quota|rate.?limit/i;

/** Verdichtet mehrere Pipeline-Läufe zu Fehlerraten je Fall und Feld. */
export function aggregateFieldErrorRates(runs: EvalRun[]): FieldErrorRate[] {
  const buckets = new Map<
    string,
    { caseId: string; fieldKey: string; hits: boolean[]; misses: number }
  >();

  for (const run of runs) {
    for (const outcome of run.outcomes) {
      const key = `${outcome.caseId}\u0000${outcome.fieldKey}`;
      const bucket = buckets.get(key) ?? {
        caseId: outcome.caseId,
        fieldKey: outcome.fieldKey,
        hits: [],
        misses: 0,
      };
      bucket.hits.push(outcome.matched);
      if (!outcome.hasProvenance) bucket.misses += 1;
      buckets.set(key, bucket);
    }
  }

  return [...buckets.values()].map(({ caseId, fieldKey, hits, misses }) => {
    const errors = hits.filter((matched) => !matched).length;
    return {
      caseId,
      fieldKey,
      runs: hits.length,
      errors,
      errorRate: errors / hits.length,
      provenanceMisses: misses,
      isFlaky: errors > 0 && errors < hits.length,
    };
  });
}

/** Ein Live-Ergebnis zählt nur mit genug Läufen je Fall und begrenzter Fehlerrate je Feld. */
export function evaluateLiveGate(rates: FieldErrorRate[]): LiveEvalGateResult {
  const failures: string[] = [];
  if (rates.length === 0) failures.push('Keine Messung vorhanden');

  for (const rate of rates) {
    const label = `${rate.caseId}/${rate.fieldKey}`;
    if (rate.runs < LIVE_EVAL_GATE.MIN_RUNS_PER_CASE) {
      failures.push(
        `${label}: nur ${rate.runs} Lauf/Läufe, mindestens ${LIVE_EVAL_GATE.MIN_RUNS_PER_CASE} nötig`
      );
    } else if (rate.errorRate > LIVE_EVAL_GATE.MAX_FIELD_ERROR_RATE) {
      failures.push(`${label}: Fehlerrate ${(rate.errorRate * 100).toFixed(0)} % über Grenze`);
    }
  }

  return { passed: failures.length === 0, failures };
}

function readStatus(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return 'statusCode' in error ? error.statusCode : 'status' in error ? error.status : undefined;
}

/** Erkennt Kontingent- und Ratenlimit-Fehler der Modellanbieter, bei denen der Lauf stoppen muss. */
export function isQuotaError(error: unknown): boolean {
  if (readStatus(error) === HTTP_TOO_MANY_REQUESTS) return true;
  return error instanceof Error && QUOTA_MESSAGE_PATTERN.test(error.message);
}

/** Harte Obergrenze für Modellaufrufe eines Laufs. */
export function createCallBudget(maxCalls: number) {
  let used = 0;
  return {
    tryConsume(): boolean {
      if (used >= maxCalls) return false;
      used += 1;
      return true;
    },
    used: () => used,
  };
}
