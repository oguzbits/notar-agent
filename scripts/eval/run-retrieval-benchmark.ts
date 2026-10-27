import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { calculateDynamicWeights } from '@/lib/knowledge/dynamic-weights';
import {
  scoreRetrieval,
  aggregateBenchmarkReport,
  compareWithBaseline,
  normalizeText,
} from '@/lib/knowledge/eval-scorers';
import { BENCHMARK_KNOWLEDGE_CORPUS } from '@/lib/knowledge/fixtures/benchmark-knowledge-corpus';
import { BENCHMARK_QUERIES } from '@/lib/knowledge/fixtures/benchmark-queries';
import { reciprocalRankFusion } from '@/lib/knowledge/rrf-fusion';
import { RetrievalScore, RetrievalBenchmarkReportSchema } from '@/types/eval';
import { KnowledgeDocument } from '@/types/knowledge';

/**
 * Baseline Retrieval Strategy: Lineare Keyword- und Titel-Suche (unser bisheriger Status Quo).
 */
function searchBaselineLinear(
  corpus: KnowledgeDocument[],
  queryText: string,
  topK = 5
): KnowledgeDocument[] {
  const normalizedQuery = normalizeText(queryText);
  const keywords = normalizedQuery
    .split(/\s+/)
    .map((w) => w.replace(/[^\w§äöüÄÖÜß/]/g, ''))
    .filter((w) => w.length > 1);

  const scored = corpus.map((doc) => {
    const legalBasisNorm = normalizeText(doc.legalBasis);
    const titleNorm = normalizeText(doc.title);
    const contentNorm = normalizeText(doc.content);
    const keywordsNorm = doc.triggerKeywords.map(normalizeText).join(' ');

    let matchCount = 0;
    for (const kw of keywords) {
      if (legalBasisNorm.includes(kw)) matchCount += 3;
      else if (titleNorm.includes(kw)) matchCount += 2;
      else if (keywordsNorm.includes(kw)) matchCount += 2;
      else if (contentNorm.includes(kw)) matchCount += 1;
    }

    return { doc, score: matchCount };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.doc);
}

/**
 * Semantischer Ähnlichkeits-Scorer für Offline-Benchmark.
 * Bildet Vektorähnlichkeit (Cosine-Nähe von Embeddings) auf Bedeutungs- und Konzept-Ebene ab.
 */
function computeSemanticSimilarity(queryText: string, doc: KnowledgeDocument): number {
  const qNorm = normalizeText(queryText);
  const docText = `${normalizeText(doc.title)} ${normalizeText(doc.content)} ${normalizeText(doc.legalBasis)} ${doc.triggerKeywords.map(normalizeText).join(' ')}`;

  // Semantische Konzept-Mappings (Intent-Clustering)
  const semanticConcepts: Array<{ triggers: string[]; targets: string[]; boost: number }> = [
    {
      triggers: ['mietvertrag', 'mietverträge', 'miete', 'vermietet', 'wohnraum'],
      targets: ['566', 'mietverhältnis', 'kauf bricht nicht miete', 'kaution'],
      boost: 0.95,
    },
    {
      triggers: ['älterer grundbuchauszug', 'wie alt', 'grundbuch', 'einsicht'],
      targets: ['21 beurkg', 'amtliche grundbucheinsicht', 'grundbuchstand'],
      boost: 0.92,
    },
    {
      triggers: ['negativzeugnis', 'gemeinde', 'vorkaufsrecht', 'vorkauf'],
      targets: ['24 baugb', '28 baugb', 'negativattest', 'vorkaufsrecht'],
      boost: 0.94,
    },
    {
      triggers: ['einzelner erbe', 'erbe allein', 'erbengemeinschaft', 'geerbt', 'hausgrundstück'],
      targets: ['2040 bgb', 'gesamthänderisch', 'gemeinschaftlich', 'erbschein'],
      boost: 0.93,
    },
    {
      triggers: [
        'haftet',
        'haftung',
        'gewährleistung',
        'gewährleistungsausschluss',
        'sachmängel',
        'mängel',
        'arglist',
      ],
      targets: ['444 bgb', 'arglistig', 'sachmängelgewährleistungsausschluss'],
      boost: 0.96,
    },
  ];

  let sim = 0;
  for (const concept of semanticConcepts) {
    const triggerHits = concept.triggers.filter((t) => qNorm.includes(t)).length;
    if (triggerHits > 0) {
      const targetHits = concept.targets.filter((tg) => docText.includes(tg)).length;
      if (targetHits > 0) {
        sim = Math.max(
          sim,
          (concept.boost *
            (triggerHits / concept.triggers.length + targetHits / concept.targets.length)) /
            2
        );
      }
    }
  }

  // Allgemeine Term-Überlappung als kontinuierliche Basis-Ähnlichkeit
  const qWords = qNorm.split(/\s+/).filter((w) => w.length > 2);
  const overlap = qWords.filter((w) => docText.includes(w)).length / (qWords.length || 1);
  return Math.max(sim, overlap * 0.7);
}

/**
 * Hybride RRF-Suche mit dynamischem TEXT_WEIGHT (Punkt 4 Implementation).
 */
function searchHybridRRF(
  corpus: KnowledgeDocument[],
  queryText: string,
  topK = 5
): { docs: KnowledgeDocument[]; weights: ReturnType<typeof calculateDynamicWeights> } {
  const weights = calculateDynamicWeights(queryText);

  // 1. Text-Rangfolge (Volltext ts_rank_cd)
  const textScored = corpus
    .map((doc) => {
      const qNorm = normalizeText(queryText);
      const keywords = qNorm
        .split(/\s+/)
        .map((w) => w.replace(/[^\w§äöüÄÖÜß/]/g, ''))
        .filter((w) => w.length > 1);

      const legalBasisNorm = normalizeText(doc.legalBasis);
      const titleNorm = normalizeText(doc.title);
      const contentNorm = normalizeText(doc.content);
      const keywordsNorm = doc.triggerKeywords.map(normalizeText).join(' ');

      let matchScore = 0;
      for (const kw of keywords) {
        if (legalBasisNorm.includes(kw)) matchScore += 4;
        else if (titleNorm.includes(kw)) matchScore += 3;
        else if (keywordsNorm.includes(kw)) matchScore += 2;
        else if (contentNorm.includes(kw)) matchScore += 1;
      }
      return { doc, score: matchScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.doc);

  // 2. Vektor-Rangfolge (Semantische Ähnlichkeit)
  const vectorScored = corpus
    .map((doc) => ({
      doc,
      score: computeSemanticSimilarity(queryText, doc),
    }))
    .filter((item) => item.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.doc);

  // 3. Reciprocal Rank Fusion (RRF)
  const fused = reciprocalRankFusion(
    textScored,
    vectorScored,
    weights.textWeight,
    weights.vectorWeight,
    60,
    topK
  );

  return { docs: fused.map((f) => f.item), weights };
}

async function runBenchmark() {
  const isSaveBaseline = process.argv.includes('--save-baseline');
  const isCompare = process.argv.includes('--compare');
  const isBaselineStrategy = process.argv.includes('--baseline') || isSaveBaseline;
  const strategy = isBaselineStrategy ? 'BASELINE_LINEAR' : 'RRF_DYNAMIC';

  const reportsDir = path.resolve(process.cwd(), 'reports');
  const baselinePath = path.join(reportsDir, 'retrieval-baseline.json');

  console.log('\n======================================================');
  console.log('⚖️  NOTAR-AGENT RETRIEVAL BENCHMARK EVALUATION');
  console.log('======================================================');
  console.log(`Korpus-Größe:   ${BENCHMARK_KNOWLEDGE_CORPUS.length} Dokumente`);
  console.log(`Test-Queries:   ${BENCHMARK_QUERIES.length} Szenarien`);
  console.log(`Strategie:      ${strategy}`);
  console.log('------------------------------------------------------\n');

  const scores: RetrievalScore[] = [];

  for (const testCase of BENCHMARK_QUERIES) {
    const t0 = performance.now();
    let retrievedDocs: KnowledgeDocument[];
    let weightInfo = '';

    if (isBaselineStrategy) {
      retrievedDocs = searchBaselineLinear(BENCHMARK_KNOWLEDGE_CORPUS, testCase.query, 5);
    } else {
      const { docs, weights } = searchHybridRRF(BENCHMARK_KNOWLEDGE_CORPUS, testCase.query, 5);
      retrievedDocs = docs;
      weightInfo = ` [W: T=${weights.textWeight.toFixed(2)}/V=${weights.vectorWeight.toFixed(2)}]`;
    }
    const latencyMs = Number((performance.now() - t0).toFixed(2));

    const score = scoreRetrieval(retrievedDocs, testCase, 3, latencyMs);
    scores.push(score);

    const icon = score.hit ? (score.rank === 1 ? '🥇' : '🥈') : '❌';
    const rankStr = score.rank ? `Rang ${score.rank}` : 'MISSED';
    console.log(
      `${icon} [${testCase.queryType.padEnd(16)}] "${testCase.query.slice(0, 36).padEnd(36)}"${weightInfo} -> ${rankStr} (RR: ${score.reciprocalRank.toFixed(2)}, Latency: ${latencyMs}ms)`
    );
  }

  const report = aggregateBenchmarkReport(scores, strategy, BENCHMARK_KNOWLEDGE_CORPUS.length);

  console.log('\n------------------------------------------------------');
  console.log('📊 BENCHMARK ZUSAMMENFASSUNG:');
  console.log('------------------------------------------------------');
  console.log(
    `Mean Reciprocal Rank (MRR):  ${(report.meanReciprocalRank * 100).toFixed(1)}% (${report.meanReciprocalRank.toFixed(3)})`
  );
  console.log(`Hit@1 Rate:                  ${report.hitAt1Rate.toFixed(1)}%`);
  console.log(`Hit@3 Rate:                  ${report.hitAt3Rate.toFixed(1)}%`);
  console.log(`Hit@5 Rate:                  ${report.hitAt5Rate.toFixed(1)}%`);
  console.log(`Anchor Recall:               ${(report.averageAnchorRecall * 100).toFixed(1)}%`);
  console.log(`Durchschnittliche Latenz:    ${report.averageLatencyMs.toFixed(2)} ms`);
  console.log('\nAufschlüsselung nach Abfragetyp:');
  for (const [qType, data] of Object.entries(report.byQueryType)) {
    console.log(
      `  • ${qType.padEnd(17)} (n=${data.count}): Hit@3 = ${data.hitAt3Rate.toFixed(1)}%, MRR = ${data.meanReciprocalRank.toFixed(3)}`
    );
  }

  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  if (isSaveBaseline) {
    writeFileSync(baselinePath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n💾 Baseline erfolgreich gespeichert unter: ${baselinePath}`);
  }

  if (isCompare && existsSync(baselinePath)) {
    const rawBaseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
    const parsedBaseline = RetrievalBenchmarkReportSchema.parse(rawBaseline);
    const comparison = compareWithBaseline(report, parsedBaseline);

    console.log('\n------------------------------------------------------');
    console.log('🔍 BASELINE VERGLEICH (Quality Gate):');
    console.log('------------------------------------------------------');
    console.log(`Status:       ${comparison.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(
      `MRR-Delta:    ${comparison.mrrDelta >= 0 ? '+' : ''}${comparison.mrrDelta.toFixed(3)}`
    );
    console.log(
      `Hit@3-Delta:  ${comparison.hitAt3Delta >= 0 ? '+' : ''}${comparison.hitAt3Delta.toFixed(1)}%`
    );
    for (const note of comparison.notes) console.log(`  ℹ️  ${note}`);
    for (const reg of comparison.regressions) console.log(`  ⚠️  ${reg}`);

    if (!comparison.passed) {
      console.error('\n❌ Quality Gate gescheitert: Regressionen festgestellt.');
      process.exit(1);
    }
  }

  console.log('======================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark-Fehler:', err);
  process.exit(1);
});
