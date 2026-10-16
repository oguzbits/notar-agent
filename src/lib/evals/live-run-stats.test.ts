import { describe, expect, it } from 'vitest';
import { LIVE_EVAL_GATE, type EvalRun } from '@/types/eval';
import {
  aggregateFieldErrorRates,
  createCallBudget,
  evaluateLiveGate,
  isQuotaError,
} from './live-run-stats';

const run = (caseId: string, matched: boolean, hasProvenance = true): EvalRun => ({
  caseId,
  outcomes: [{ caseId, fieldKey: 'kaufpreis', matched, hasProvenance }],
});

describe('aggregateFieldErrorRates', () => {
  it('zählt Fehler und fehlende Belege je Fall und Feld über alle Läufe', () => {
    const [rate] = aggregateFieldErrorRates([
      run('fall-01', true),
      run('fall-01', false),
      run('fall-01', true, false),
    ]);
    expect(rate).toMatchObject({ runs: 3, errors: 1, provenanceMisses: 1, isFlaky: true });
    expect(rate?.errorRate).toBeCloseTo(1 / 3);
  });

  it('trennt Fälle voneinander', () => {
    const rates = aggregateFieldErrorRates([run('a', true), run('b', false)]);
    expect(rates.map((r) => [r.caseId, r.errors])).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
  });

  it('meldet ein durchgehend falsches Feld nicht als wechselhaft', () => {
    const [rate] = aggregateFieldErrorRates([run('a', false), run('a', false)]);
    expect(rate?.isFlaky).toBe(false);
  });
});

describe('evaluateLiveGate', () => {
  const runs = (n: number, matched: boolean) =>
    Array.from({ length: n }, () => run('fall-01', matched));

  it('besteht bei ausreichend Läufen und fehlerfreien Feldern', () => {
    const result = evaluateLiveGate(
      aggregateFieldErrorRates(runs(LIVE_EVAL_GATE.MIN_RUNS_PER_CASE, true))
    );
    expect(result).toEqual({ passed: true, failures: [] });
  });

  it('fällt ohne jede Messung durch (kein leeres Bestehen)', () => {
    expect(evaluateLiveGate([]).passed).toBe(false);
  });

  it('fällt durch, wenn zu wenige Läufe vorliegen (kein Zufallstreffer mit n=1)', () => {
    const result = evaluateLiveGate(aggregateFieldErrorRates(runs(1, true)));
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('fall-01');
  });

  it('fällt durch, wenn die Fehlerrate eines Felds die Schwelle übersteigt', () => {
    const result = evaluateLiveGate(
      aggregateFieldErrorRates([...runs(2, true), ...runs(1, false)])
    );
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('kaufpreis');
  });
});

describe('isQuotaError', () => {
  it.each([
    [{ statusCode: 429 }],
    [{ status: 429 }],
    [new Error('RESOURCE_EXHAUSTED: quota exceeded')],
    [new Error('You exceeded your current quota')],
  ])('erkennt Kontingentfehler %#', (error) => {
    expect(isQuotaError(error)).toBe(true);
  });

  it('hält andere Fehler nicht für Kontingentfehler', () => {
    expect(isQuotaError(new Error('Netzwerkfehler'))).toBe(false);
    expect(isQuotaError({ statusCode: 500 })).toBe(false);
  });
});

describe('createCallBudget', () => {
  it('verweigert Aufrufe über dem Limit', () => {
    const budget = createCallBudget(2);
    expect([budget.tryConsume(), budget.tryConsume(), budget.tryConsume()]).toEqual([
      true,
      true,
      false,
    ]);
    expect(budget.used()).toBe(2);
  });
});
