import { describe, expect, it } from 'vitest';
import { RETRIEVAL_EVAL_CASES } from '@/test/fixtures/retrieval-eval-cases';
import { CASE_TYPES } from '@/types/dossier';
import {
  RETRIEVAL_EVAL_CASE_KINDS as KIND,
  RetrievalEvalBaseline,
  RetrievalEvalCaseSchema,
  RetrievalEvalResult,
} from '@/types/eval';
import {
  compareToBaseline,
  GATE_TOLERANCE,
  resolveLegalBasis,
  summarizeRetrievalEval,
} from './eval-gate';
import { BENCHMARK_KNOWLEDGE_CORPUS } from './fixtures/benchmark-knowledge-corpus';

const result = (
  kind: RetrievalEvalResult['kind'],
  relevantCount: number,
  coveredCount: number
): RetrievalEvalResult => ({
  caseId: `${kind}-${relevantCount}-${coveredCount}`,
  kind,
  relevantCount,
  coveredCount,
});

describe('summarizeRetrievalEval', () => {
  it('zählt Teilabdeckung anteilig und ignoriert Fälle ohne Treffer', () => {
    const summary = summarizeRetrievalEval([
      result(KIND.KENNUNG, 2, 1),
      result(KIND.OHNE_KENNUNG, 1, 1),
      result(KIND.OHNE_TREFFER, 0, 0),
    ]);
    expect(summary.cases).toBe(3);
    expect(summary.promptCoverage).toBeCloseTo(0.75);
    expect(summary.fullCoverageRate).toBeCloseTo(0.5);
    expect(summary.coverageWithoutIdentifier).toBe(1);
  });
  it('meldet keine Abdeckung ohne Fälle der Art OHNE_KENNUNG als null', () => {
    expect(
      summarizeRetrievalEval([result(KIND.KENNUNG, 1, 1)]).coverageWithoutIdentifier
    ).toBeNull();
  });
  it('wirft ohne Fälle mit einschlägiger Norm', () => {
    expect(() => summarizeRetrievalEval([])).toThrow();
    expect(() => summarizeRetrievalEval([result(KIND.OHNE_TREFFER, 0, 0)])).toThrow();
  });
  it('wirft, wenn mehr Normen abgedeckt als einschlägig sind', () => {
    expect(() => summarizeRetrievalEval([result(KIND.KENNUNG, 1, 2)])).toThrow();
  });
});

describe('compareToBaseline', () => {
  const baseline: RetrievalEvalBaseline = {
    date: '2026-10-27',
    cases: 48,
    promptCoverage: 0.96,
    fullCoverageRate: 0.95,
    coverageWithoutIdentifier: 0.97,
  };
  const same = {
    cases: 48,
    promptCoverage: 0.96,
    fullCoverageRate: 0.95,
    coverageWithoutIdentifier: 0.97,
  };

  it('meldet nichts bei gleichem oder besserem Stand', () => {
    expect(compareToBaseline(same, baseline)).toEqual([]);
    expect(compareToBaseline({ ...same, promptCoverage: 1 }, baseline)).toEqual([]);
  });
  it('meldet nichts genau auf der Toleranz, aber ein Maß knapp darunter', () => {
    const edge = baseline.promptCoverage - GATE_TOLERANCE;
    expect(compareToBaseline({ ...same, promptCoverage: edge }, baseline)).toEqual([]);
    const findings = compareToBaseline({ ...same, promptCoverage: edge - 0.01 }, baseline);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('promptCoverage');
  });
  it('meldet jedes verschlechterte Maß einzeln', () => {
    const findings = compareToBaseline(
      { ...same, fullCoverageRate: 0.5, coverageWithoutIdentifier: 0.5 },
      baseline
    );
    expect(findings).toHaveLength(2);
  });
  it('überspringt ein nicht gemessenes Maß', () => {
    expect(compareToBaseline({ ...same, coverageWithoutIdentifier: null }, baseline)).toEqual([]);
  });
  it('wirft bei fehlerhafter Baseline', () => {
    expect(() => compareToBaseline(same, { date: '' } as never)).toThrow();
  });
});

describe('resolveLegalBasis', () => {
  const docs = [
    { legalBasis: '§ 1850 BGB' },
    { legalBasis: '§ 1643, § 1850 BGB' },
    { legalBasis: '§ 12 WEG' },
  ];
  it('bevorzugt die genaue Übereinstimmung vor dem Teiltreffer', () => {
    expect(resolveLegalBasis(docs, '§ 1850 BGB')).toBe(docs[0]);
  });
  it('findet ein eindeutiges Dokument über einen Teiltreffer', () => {
    expect(resolveLegalBasis(docs, '§ 12 WEG')).toBe(docs[2]);
    expect(resolveLegalBasis(docs, '§ 1643')).toBe(docs[1]);
  });
  it('wirft bei mehrdeutiger oder unbekannter Rechtsgrundlage', () => {
    expect(() => resolveLegalBasis(docs, 'BGB')).toThrow();
    expect(() => resolveLegalBasis(docs, '§ 999 XYZ')).toThrow();
  });
});

describe('Fixtures des Eval-Gates', () => {
  it('sind gültig und haben eindeutige IDs', () => {
    const ids = RETRIEVAL_EVAL_CASES.map((c) => RetrievalEvalCaseSchema.parse(c).id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(RETRIEVAL_EVAL_CASES.length).toBeGreaterThanOrEqual(40);
  });
  it('lösen jede Rechtsgrundlage auf genau ein Dokument des Benchmark-Korpus auf', () => {
    for (const testCase of RETRIEVAL_EVAL_CASES) {
      for (const basis of testCase.relevantLegalBases) {
        expect(
          () => resolveLegalBasis(BENCHMARK_KNOWLEDGE_CORPUS, basis),
          testCase.id
        ).not.toThrow();
      }
    }
  });
  it('decken beide Vorgangstypen und alle drei Arten ab', () => {
    expect(new Set(RETRIEVAL_EVAL_CASES.map((c) => c.kind))).toEqual(new Set(Object.values(KIND)));
    expect(new Set(RETRIEVAL_EVAL_CASES.map((c) => c.caseType))).toEqual(
      new Set(Object.values(CASE_TYPES))
    );
  });
});
