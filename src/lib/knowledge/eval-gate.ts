import {
  RETRIEVAL_EVAL_CASE_KINDS,
  RetrievalEvalBaseline,
  RetrievalEvalBaselineSchema,
  RetrievalEvalResult,
  RetrievalEvalSummary,
} from '@/types/eval';

/**
 * Wie weit ein Maß unter die Baseline fallen darf, bevor der Lauf als schlechter gilt. Bei rund 40 Fällen
 * entspricht ein Fall etwa 0,025; die Schwelle erlaubt zwei. Geschätzt aus einem einzelnen Lauf: nach
 * Wiederholungsläufen aus deren Streuung festlegen.
 */
export const GATE_TOLERANCE = 0.05;

/**
 * Das Dokument zu einer Rechtsgrundlage der Grundwahrheit: genaue Übereinstimmung zuerst, sonst genau
 * ein Dokument, das sie enthält. Mehrdeutig oder unbekannt wirft, damit keine Grundwahrheit still driftet.
 */
export function resolveLegalBasis<T extends { legalBasis: string }>(docs: T[], basis: string): T {
  const exact = docs.filter((d) => d.legalBasis === basis);
  const hits = exact.length === 1 ? exact : docs.filter((d) => d.legalBasis.includes(basis));
  const [only] = hits;
  if (hits.length !== 1 || !only) {
    throw new Error(
      `Rechtsgrundlage "${basis}" trifft ${hits.length} Dokumente statt genau eines.`
    );
  }
  return only;
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const coverage = (r: RetrievalEvalResult) => r.coveredCount / r.relevantCount;

export function summarizeRetrievalEval(results: RetrievalEvalResult[]): RetrievalEvalSummary {
  const withNorms = results.filter((r) => r.relevantCount > 0);
  if (withNorms.length === 0) {
    throw new Error('Eval-Gate braucht mindestens einen Fall mit einschlägiger Norm.');
  }
  const invalid = withNorms.find((r) => r.coveredCount > r.relevantCount);
  if (invalid) throw new Error(`Fall ${invalid.caseId}: mehr abgedeckt als einschlägig.`);

  const withoutIdentifier = withNorms.filter(
    (r) => r.kind === RETRIEVAL_EVAL_CASE_KINDS.OHNE_KENNUNG
  );
  return {
    cases: results.length,
    promptCoverage: mean(withNorms.map(coverage)),
    fullCoverageRate:
      withNorms.filter((r) => r.coveredCount === r.relevantCount).length / withNorms.length,
    coverageWithoutIdentifier: withoutIdentifier.length
      ? mean(withoutIdentifier.map(coverage))
      : null,
  };
}

const GATED = ['promptCoverage', 'fullCoverageRate', 'coverageWithoutIdentifier'] as const;

/** Die Maße, die mehr als die Toleranz unter der Baseline liegen, in Worten; leer heißt nicht schlechter. */
export function compareToBaseline(
  summary: RetrievalEvalSummary,
  baseline: RetrievalEvalBaseline,
  tolerance = GATE_TOLERANCE
): string[] {
  const reference = RetrievalEvalBaselineSchema.parse(baseline);
  return GATED.flatMap((measure) => {
    const value = summary[measure];
    const expected = reference[measure];
    // Ein nicht gemessenes Maß kann nicht schlechter sein; 1e-9 fängt Gleitkommafehler an der Schwelle ab.
    if (value === null || expected === null || value + 1e-9 >= expected - tolerance) return [];
    return [`${measure}: ${value.toFixed(2)} statt ${expected.toFixed(2)}`];
  });
}
