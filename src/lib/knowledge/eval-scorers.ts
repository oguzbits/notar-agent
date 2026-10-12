import {
  RetrievalTestCase,
  RetrievalScore,
  RetrievalBenchmarkReport,
  RETRIEVAL_QUERY_TYPES,
  RetrievalQueryType,
} from '@/types/eval';
import { KnowledgeDocument } from '@/types/knowledge';

/**
 * Normalisiert Text für deterministischen Abgleich (NFKC Unicode, Kleinschreibung, Whitespace-Kompaktierung).
 * Angelehnt an notebooklm-klon (scorers.ts).
 */
export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Bewertet das Retrieval-Ergebnis für eine Test-Query deterministisch gegen Ground-Truth.
 *
 * @param retrievedDocs Die vom System zurückgegebenen Dokumente in Rangfolge.
 * @param testCase Der Benchmark-Testfall mit erwarteten Rechtsgrundlagen und Ankern.
 * @param k Der Top-K-Cutoff (Standard: 3).
 * @param latencyMs Gemessene Ausführungszeit der Anfrage in Millisekunden.
 */
export function scoreRetrieval(
  retrievedDocs: KnowledgeDocument[],
  testCase: RetrievalTestCase,
  k = 3,
  latencyMs = 0
): RetrievalScore {
  const topKDocs = retrievedDocs.slice(0, k);
  const normalizedExpectedBases = testCase.expectedLegalBases.map(normalizeText);
  const normalizedExpectedAnchors = testCase.expectedAnchors.map(normalizeText);

  // 1. Finde den ersten Match nach Rechtsgrundlage oder primärem Anker
  let matchIndex = -1;
  for (let i = 0; i < topKDocs.length; i++) {
    const doc = topKDocs[i];
    if (!doc) continue;
    const docLegalBasis = normalizeText(doc.legalBasis);
    const docTitle = normalizeText(doc.title);
    const docContent = normalizeText(doc.content);

    const matchesLegalBasis = normalizedExpectedBases.some(
      (expected) => docLegalBasis.includes(expected) || expected.includes(docLegalBasis)
    );
    const matchesAnchors =
      normalizedExpectedAnchors.length > 0 &&
      normalizedExpectedAnchors.some(
        (anchor) => docTitle.includes(anchor) || docContent.includes(anchor)
      );

    if (matchesLegalBasis || matchesAnchors) {
      matchIndex = i;
      break;
    }
  }

  const hit = matchIndex >= 0;
  const rank = hit ? matchIndex + 1 : null;
  const reciprocalRank = rank ? 1.0 / rank : 0.0;

  // 2. Berechne Anchor Recall über den gesamten Top-K-Kontext
  let anchorRecall: number | null = null;
  if (normalizedExpectedAnchors.length > 0) {
    const fullTopKText = topKDocs
      .map((d) => `${normalizeText(d.title)} ${normalizeText(d.content)}`)
      .join(' ');
    const foundAnchors = normalizedExpectedAnchors.filter((anchor) =>
      fullTopKText.includes(anchor)
    ).length;
    anchorRecall = foundAnchors / normalizedExpectedAnchors.length;
  }

  return {
    caseId: testCase.id,
    query: testCase.query,
    queryType: testCase.queryType,
    hit,
    rank,
    reciprocalRank,
    anchorRecall,
    topLegalBases: topKDocs.map((d) => d.legalBasis),
    latencyMs,
  };
}

/**
 * Aggregiert Einzelergebnisse zu einem vollständigen RetrievalBenchmarkReport.
 */
export function aggregateBenchmarkReport(
  scores: RetrievalScore[],
  strategy: string,
  corpusSize: number
): RetrievalBenchmarkReport {
  const total = scores.length;
  if (total === 0) {
    throw new Error('Kann keinen Benchmark-Report aus leeren Einzelergebnissen aggregieren.');
  }

  const hitAt1Count = scores.filter((s) => s.rank === 1).length;
  const hitAt3Count = scores.filter((s) => s.rank !== null && s.rank <= 3).length;
  const hitAt5Count = scores.filter((s) => s.rank !== null && s.rank <= 5).length;

  const totalRR = scores.reduce((sum, s) => sum + s.reciprocalRank, 0);
  const mrr = totalRR / total;

  const scoresWithAnchors = scores.filter((s) => s.anchorRecall !== null);
  const avgAnchorRecall =
    scoresWithAnchors.length > 0
      ? scoresWithAnchors.reduce((sum, s) => sum + (s.anchorRecall ?? 0), 0) /
        scoresWithAnchors.length
      : 1.0;

  const avgLatency = scores.reduce((sum, s) => sum + s.latencyMs, 0) / total;

  // Gruppierung nach Query-Typ
  const queryTypes: RetrievalQueryType[] = [
    RETRIEVAL_QUERY_TYPES.STATUTORY_EXACT,
    RETRIEVAL_QUERY_TYPES.NUMBER_PARCEL,
    RETRIEVAL_QUERY_TYPES.SEMANTIC_CONCEPT,
    RETRIEVAL_QUERY_TYPES.DISTRACTOR,
  ];

  const byQueryType = Object.fromEntries(
    queryTypes.map((qt) => {
      const typeScores = scores.filter((s) => s.queryType === qt);
      const count = typeScores.length;
      if (count === 0) {
        return [qt, { count: 0, hitAt3Rate: 0, meanReciprocalRank: 0 }];
      }
      const typeHit3 = typeScores.filter((s) => s.rank !== null && s.rank <= 3).length;
      const typeRR = typeScores.reduce((sum, s) => sum + s.reciprocalRank, 0);
      return [
        qt,
        {
          count,
          hitAt3Rate: (typeHit3 / count) * 100.0,
          meanReciprocalRank: typeRR / count,
        },
      ];
    })
  ) as RetrievalBenchmarkReport['byQueryType'];

  return {
    timestamp: new Date().toISOString(),
    strategy,
    totalQueries: total,
    corpusSize,
    hitAt1Rate: (hitAt1Count / total) * 100.0,
    hitAt3Rate: (hitAt3Count / total) * 100.0,
    hitAt5Rate: (hitAt5Count / total) * 100.0,
    meanReciprocalRank: mrr,
    averageAnchorRecall: avgAnchorRecall,
    averageLatencyMs: avgLatency,
    byQueryType,
    results: scores,
  };
}

export interface BaselineComparisonResult {
  passed: boolean;
  mrrDelta: number;
  hitAt3Delta: number;
  notes: string[];
  regressions: string[];
}

/**
 * Vergleicht einen aktuellen Benchmark-Report mit einer gespeicherten Baseline (manda-Muster: gate.ts).
 * Schlägt fehl (passed: false), wenn MRR oder Hit@3 signifikant regredieren.
 */
export function compareWithBaseline(
  current: RetrievalBenchmarkReport,
  baseline: RetrievalBenchmarkReport
): BaselineComparisonResult {
  const mrrDelta = current.meanReciprocalRank - baseline.meanReciprocalRank;
  const hitAt3Delta = current.hitAt3Rate - baseline.hitAt3Rate;
  const regressions: string[] = [];
  const notes: string[] = [];

  if (mrrDelta < -0.02) {
    regressions.push(
      `MRR-Regression erkannt: ${current.meanReciprocalRank.toFixed(3)} < Baseline ${baseline.meanReciprocalRank.toFixed(3)} (Delta: ${mrrDelta.toFixed(3)})`
    );
  }

  if (hitAt3Delta < -2.0) {
    regressions.push(
      `Hit@3-Rate regrediert: ${current.hitAt3Rate.toFixed(1)}% < Baseline ${baseline.hitAt3Rate.toFixed(1)}% (Delta: ${hitAt3Delta.toFixed(1)}%)`
    );
  }

  if (mrrDelta >= 0) {
    notes.push(
      `MRR verbessert oder stabil: +${mrrDelta.toFixed(3)} (${baseline.meanReciprocalRank.toFixed(3)} -> ${current.meanReciprocalRank.toFixed(3)})`
    );
  }
  if (hitAt3Delta >= 0) {
    notes.push(
      `Hit@3-Rate verbessert oder stabil: +${hitAt3Delta.toFixed(1)}% (${baseline.hitAt3Rate.toFixed(1)}% -> ${current.hitAt3Rate.toFixed(1)}%)`
    );
  }

  return {
    passed: regressions.length === 0,
    mrrDelta,
    hitAt3Delta,
    notes,
    regressions,
  };
}
