import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  scoreRetrieval,
  aggregateBenchmarkReport,
  compareWithBaseline,
  normalizeText,
} from '@/lib/knowledge/eval-scorers';
import { BENCHMARK_KNOWLEDGE_CORPUS } from '@/lib/knowledge/fixtures/benchmark-knowledge-corpus';
import { BENCHMARK_QUERIES } from '@/lib/knowledge/fixtures/benchmark-queries';
import { RetrievalScore, RetrievalBenchmarkReportSchema } from '@/types/eval';
import { KnowledgeDocument } from '@/types/knowledge';

/**
 * Baseline Retrieval Strategy: Lineare Keyword- und Titel-Suche (unser bisheriger Status Quo).
 * Simuliert den ungewichteten Volltext-Treffer ohne RRF und ohne Vektor-Rank.
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

async function runBenchmark() {
  const isSaveBaseline = process.argv.includes('--save-baseline');
  const isCompare = process.argv.includes('--compare');
  const reportsDir = path.resolve(process.cwd(), 'reports');
  const baselinePath = path.join(reportsDir, 'retrieval-baseline.json');

  console.log('\n======================================================');
  console.log('⚖️  NOTAR-AGENT RETRIEVAL BENCHMARK EVALUATION');
  console.log('======================================================');
  console.log(`Korpus-Größe:   ${BENCHMARK_KNOWLEDGE_CORPUS.length} Dokumente`);
  console.log(`Test-Queries:   ${BENCHMARK_QUERIES.length} Szenarien`);
  console.log(`Strategie:      BASELINE_LINEAR (Pre-Implementation Baseline)`);
  console.log('------------------------------------------------------\n');

  const scores: RetrievalScore[] = [];

  for (const testCase of BENCHMARK_QUERIES) {
    const t0 = performance.now();
    const retrievedDocs = searchBaselineLinear(BENCHMARK_KNOWLEDGE_CORPUS, testCase.query, 5);
    const latencyMs = Number((performance.now() - t0).toFixed(2));

    const score = scoreRetrieval(retrievedDocs, testCase, 3, latencyMs);
    scores.push(score);

    const icon = score.hit ? (score.rank === 1 ? '🥇' : '🥈') : '❌';
    const rankStr = score.rank ? `Rang ${score.rank}` : 'MISSED';
    console.log(
      `${icon} [${testCase.queryType.padEnd(16)}] "${testCase.query.slice(0, 38).padEnd(38)}" -> ${rankStr} (RR: ${score.reciprocalRank.toFixed(2)}, Latency: ${latencyMs}ms)`
    );
  }

  const report = aggregateBenchmarkReport(
    scores,
    'BASELINE_LINEAR',
    BENCHMARK_KNOWLEDGE_CORPUS.length
  );

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
  }

  console.log('======================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark-Fehler:', err);
  process.exit(1);
});
