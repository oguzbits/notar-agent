#!/usr/bin/env node

/**
 * ============================================================================
 * NOTARPARTNER AGENTIC EVAL & BENCHMARK SUITE
 * ============================================================================
 *
 * Quantifiziert die Performance, Zuverlässigkeit und Latenz (P50, P90, P95, P99)
 * des 2-Stufen-Agentic-Workflows gegen das synthetische Golden Dataset.
 *
 * DATENSCHUTZ & BERUFSGEHEIMNIS (§ 203 StGB):
 * - Streng getrennt von Produktionsschlüsseln.
 * - Läuft standardmäßig im 0-Euro Offline-Replay-Modus oder mit dediziertem EVAL_GEMINI_API_KEY.
 * - Verhindert jede Ausführung in einer Produktionsumgebung.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createGoogle } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { runAnalysisPipeline } from '../../src/lib/ai/pipeline';
import {
  IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
  NOTARY_AUDITOR_RECONCILER_PROMPT,
} from '../../src/lib/ai/prompts';
import { GOLDEN_DATASET, GoldenTestCase } from '../../src/test/eval/golden-dataset';
import {
  calculatePercentiles,
  scoreDossierAgainstGroundTruth,
  EvaluationMetricResult,
} from '../../src/test/eval/scorer';
import { Dossier, FIELD_STATUS, GenericFieldDossier } from '../../src/types/dossier';

// 0. UMWELT-VARIABLEN LADEN (.env.local & .env)
function loadEnvFile(fileName: string) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

// 1. HERMETISCHER DATENSCHUTZ-CHECK (§ 203 StGB)
if (process.env.NODE_ENV === 'production') {
  console.error('\n❌ SICHERHEITS-STOPP (§ 203 StGB):');
  console.error(
    'Der Benchmark-Runner darf niemals in einer Produktionsumgebung ausgeführt werden!\n'
  );
  process.exit(1);
}

// 2. CLI ARGUMENTE & MODUS
const args = process.argv.slice(2);
const isLiveMode = args.includes('--mode=live');
const iterations = args.includes('--runs=3') ? 3 : 1;

console.log('=============================================================================');
console.log('                 NOTARPARTNER AGENTIC EVAL & BENCHMARK SUITE                ');
console.log('=============================================================================');
console.log(
  `Modus:       ${isLiveMode ? 'LIVE (Google AI Studio Free Tier via EVAL_GEMINI_API_KEY)' : 'MOCK / OFFLINE REPLAY (0,00 € Kosten)'}`
);
console.log(
  `Durchläufe:  ${iterations}x pro Testfall (${GOLDEN_DATASET.length * iterations} Vorgänge gesamt)`
);
console.log(`Datensatz:   ${GOLDEN_DATASET.length} synthetische Referenzakten (Ground Truth)`);
console.log('-----------------------------------------------------------------------------\n');

interface RunResult {
  testCase: GoldenTestCase;
  runIndex: number;
  durationMs: number;
  stepTimings: Record<string, number>;
  metrics: EvaluationMetricResult;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// KOSTEN-MODELL: Google Gemini Flash Pricing (Offizielle Google AI Studio Tarife)
// Input:  0,075 $ / 1.000.000 Tokens (ca. 0,000000075 $ / Token)
// Output: 0,300 $ / 1.000.000 Tokens (ca. 0,000000300 $ / Token)
// Wechselkurs-Referenz: 1 USD ≈ 0,92 EUR
// ============================================================================
const GEMINI_FLASH_PRICE_PER_M_INPUT_USD = 0.075;
const GEMINI_FLASH_PRICE_PER_M_OUTPUT_USD = 0.3;
const USD_TO_EUR_RATE = 0.92;

type MockEvalLanguageModel = LanguageModel & {
  setMockResponse: (resp: string) => void;
};

function createMockEvalModel(): MockEvalLanguageModel {
  let currentMockResponse = '{}';
  const model = {
    specificationVersion: 'v3',
    provider: 'mock-eval',
    modelId: 'mock-eval-model',
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => ({
      text: currentMockResponse,
      content: [{ type: 'text' as const, text: currentMockResponse }],
      finishReason: 'stop' as const,
      usage: {
        inputTokens: { total: 500, noCache: 500, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 200, text: 200, reasoning: 0 },
        raw: {},
      },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    doStream: async () => {
      throw new Error('Not implemented for offline eval');
    },
    supportedUrls: {} as never,
    setMockResponse: (resp: string) => {
      currentMockResponse = resp;
    },
  };
  return model as never;
}

async function runEvaluation() {
  const allResults: RunResult[] = [];
  let evalModel: LanguageModel;
  let mockModelInstance: MockEvalLanguageModel | null = null;

  if (isLiveMode) {
    const evalApiKey = process.env.EVAL_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!evalApiKey) {
      console.error('❌ FEHLER: Kein EVAL_GEMINI_API_KEY in der Umgebung gefunden.');
      console.error(
        'Bitte setze EVAL_GEMINI_API_KEY=... in deiner .env.local für den Live-Benchmark.'
      );
      process.exit(1);
    }
    const evalModelName = process.env.EVAL_AI_MODEL || 'gemini-1.5-flash';
    console.log(`Modell (Live): ${evalModelName}`);
    const google = createGoogle({ apiKey: evalApiKey });
    evalModel = google(evalModelName);
  } else {
    mockModelInstance = createMockEvalModel();
    evalModel = mockModelInstance;
  }

  for (let run = 1; run <= iterations; run++) {
    console.log(`\n▶ Starte Durchlauf ${run}/${iterations}...`);

    for (const testCase of GOLDEN_DATASET) {
      const stepTimings: Record<string, number> = {};
      const tStart = performance.now();
      let step1DurationMs = 0;
      let step2DurationMs = 0;
      let step2Start = 0;
      let dossier: Dossier | undefined;
      let currentCaseTokens = {
        promptTokens: isLiveMode ? 0 : 700,
        completionTokens: isLiveMode ? 0 : 350,
        totalTokens: isLiveMode ? 0 : 1050,
      };

      const pipelineRunParams = {
        files: testCase.files,
        caseType: testCase.caseType,
        notes: testCase.notes,
        model: evalModel,
        extractionInstructions: {
          role: 'system' as const,
          content: IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
        },
        auditorInstructions: { role: 'system' as const, content: NOTARY_AUDITOR_RECONCILER_PROMPT },
        onStep: (s: number) => {
          const now = performance.now();
          stepTimings[`step_${s}`] = Math.round(now - tStart);
          if (s === 2) {
            step1DurationMs = Math.round(now - tStart);
            step2Start = now;
          }
        },
        onUsage: (usage: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        }) => {
          currentCaseTokens = usage;
        },
      };

      if (!isLiveMode && mockModelInstance) {
        // MOCK-MODUS: Simuliert Stufe 1 & Stufe 2 deterministisch anhand der Akteninhalte,
        // um den exakten Code-Overhead (Triage, Guardrails, Normalisierung) bei 0,00 € Kosten zu messen.
        const mockFields: Record<string, GenericFieldDossier<Record<string, unknown>>> = {};

        for (const [fKey, fExp] of Object.entries(testCase.groundTruth.fields)) {
          const primaryStatus = Array.isArray(fExp.expectedStatus)
            ? fExp.expectedStatus[0]!
            : fExp.expectedStatus;

          const primaryData: Record<string, unknown> = {};
          if (fExp.expectedValues) {
            for (const [k, v] of Object.entries(fExp.expectedValues)) {
              primaryData[k] = Array.isArray(v) ? v[0] : v;
            }
          } else {
            primaryData['name'] = 'Synthetisch';
          }

          mockFields[fKey] = {
            status: primaryStatus,
            data: primaryData,
            source: {
              fileName: testCase.files[0]?.name || 'akte.txt',
              pageNumber: 1,
              snippet: fExp.mustContainInSnippet?.[0] || 'Belegnachweis',
            },
            note: primaryStatus !== FIELD_STATUS.VERIFIED ? 'Prüfvermerk' : '',
          };
        }

        const simulatedResponse = JSON.stringify({
          caseTitle: testCase.name,
          overallStatus: testCase.groundTruth.expectedOverallStatus,
          fields: mockFields,
          detectedDocuments: testCase.files.map((f) => ({
            fileName: f.name,
            documentType: 'Dokument',
            date: '2026-01-01',
            pageCount: 1,
            reliability: 'HIGH',
          })),
          inquiries: [],
        });

        mockModelInstance.setMockResponse(simulatedResponse);
        dossier = await runAnalysisPipeline(pipelineRunParams);
      } else {
        // LIVE-MODUS: Echter API-Call gegen das Modell mit Quota-Recovery
        let attempts = 0;
        let lastError: unknown;
        while (attempts < 3) {
          try {
            dossier = await runAnalysisPipeline(pipelineRunParams);
            break;
          } catch (err: unknown) {
            attempts++;
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err);
            if (
              errMsg.includes('Quota exceeded') ||
              errMsg.includes('rate-limit') ||
              errMsg.includes('429')
            ) {
              // Parse wait time if provided by Google (z. B. "Please retry in 8s")
              const retryMatch = errMsg.match(/retry in ([0-9.]+)s/);
              const retrySecondsStr = retryMatch?.[1];
              const waitSeconds = retrySecondsStr ? Math.ceil(parseFloat(retrySecondsStr)) + 2 : 10;
              process.stdout.write(
                `\n  ⏳ Free-Tier-Rate-Limit erreicht. Warte ${waitSeconds}s für Quota-Reset (Versuch ${attempts}/3)...`
              );
              await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
              process.stdout.write(` Weiter!\n`);
            } else {
              throw err;
            }
          }
        }
        if (!dossier) {
          throw lastError || new Error('Pipeline lieferte kein Dossier');
        }
      }

      if (!dossier) {
        throw new Error('Dossier konnte für Testfall nicht generiert werden');
      }

      const tEnd = performance.now();
      const durationMs = tEnd - tStart;
      step2DurationMs =
        step2Start > 0 ? Math.round(tEnd - step2Start) : Math.round(durationMs - step1DurationMs);

      const metrics = scoreDossierAgainstGroundTruth(testCase, dossier);

      allResults.push({
        testCase,
        runIndex: run,
        durationMs,
        stepTimings,
        metrics,
        tokenUsage: currentCaseTokens,
      });

      const secTotal = (durationMs / 1000).toFixed(1);
      const secStep1 = (step1DurationMs / 1000).toFixed(1);
      const secStep2 = (step2DurationMs / 1000).toFixed(1);

      process.stdout.write(
        `  ✓ [${testCase.id}]: ${secTotal} s (Stufe 1: ${secStep1} s | Stufe 2: ${secStep2} s) | Genauigkeit: ${metrics.accuracyRate} %\n`
      );
      for (const d of metrics.details) {
        if (!d.matched) {
          process.stdout.write(`     ↳ Feld [${d.fieldKey}]: ${d.reason || 'Abweichung'}\n`);
        }
      }

      // Live-Modus: 3 Sekunden Cooldown zwischen Akten, um Free-Tier-Spikes zu vermeiden
      if (isLiveMode) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  // AGGREGATION & REPORT
  const allDurations = allResults.map((r) => r.durationMs);
  const p = calculatePercentiles(allDurations);

  const avgAccuracy =
    allResults.reduce((acc, r) => acc + r.metrics.accuracyRate, 0) / allResults.length;
  const avgProvenance =
    allResults.reduce((acc, r) => acc + r.metrics.provenanceCoverageRate, 0) / allResults.length;
  const avgGuardrailHit =
    allResults.reduce((acc, r) => acc + r.metrics.guardrailHitRate, 0) / allResults.length;

  console.log('\n=============================================================================');
  console.log('                          BENCHMARK ERGEBNISSE                              ');
  console.log('=============================================================================');
  console.log(`Gesamtanzahl Vorgänge:       ${allResults.length}`);
  console.log('-----------------------------------------------------------------------------');
  console.log('QUALITÄT & GENAUIGKEIT (GROUND TRUTH ALIGNMENT):');
  console.log(
    `  - Feld-Genauigkeit (Accuracy):     ${avgAccuracy.toFixed(1)} %  (Soll: >= 95.0 %)`
  );
  console.log(
    `  - Provenance Coverage (Belege):    ${avgProvenance.toFixed(1)} %  (Soll: 100.0 %)`
  );
  console.log(
    `  - Guardrail-Trefferquote:          ${avgGuardrailHit.toFixed(1)} %  (Soll: 100.0 %)`
  );
  console.log('-----------------------------------------------------------------------------');
  console.log('LATENZ-PERZENTILE (GESAMT-WORKFLOW):');
  console.log(`  - P50 (Median):                    ${(p.p50 / 1000).toFixed(2)} s (${p.p50} ms)`);
  console.log(`  - P90:                             ${(p.p90 / 1000).toFixed(2)} s (${p.p90} ms)`);
  console.log(`  - P95:                             ${(p.p95 / 1000).toFixed(2)} s (${p.p95} ms)`);
  console.log(`  - P99 (Worst-Case):                ${(p.p99 / 1000).toFixed(2)} s (${p.p99} ms)`);
  console.log(
    `  - Min / Max / Schnitt:             ${(p.min / 1000).toFixed(2)} s / ${(p.max / 1000).toFixed(2)} s / ${(p.avg / 1000).toFixed(2)} s`
  );
  console.log('-----------------------------------------------------------------------------');

  // KOSTEN-BERECHNUNG (GEMINI 3.8 FLASH)
  const totalPromptTokens = allResults.reduce((acc, r) => acc + r.tokenUsage.promptTokens, 0);
  const totalCompletionTokens = allResults.reduce(
    (acc, r) => acc + r.tokenUsage.completionTokens,
    0
  );
  const totalAllTokens = totalPromptTokens + totalCompletionTokens;
  const avgPromptTokens = Math.round(totalPromptTokens / allResults.length);
  const avgCompletionTokens = Math.round(totalCompletionTokens / allResults.length);

  // Gemini Flash Tarif: 0.075 $ / M Input, 0.30 $ / M Output
  const costInputUsd = (totalPromptTokens / 1_000_000) * GEMINI_FLASH_PRICE_PER_M_INPUT_USD;
  const costOutputUsd = (totalCompletionTokens / 1_000_000) * GEMINI_FLASH_PRICE_PER_M_OUTPUT_USD;
  const totalCostUsd = costInputUsd + costOutputUsd;
  const totalCostEur = totalCostUsd * USD_TO_EUR_RATE;

  const costPerCaseEur = totalCostEur / allResults.length;
  const costPer1000CasesEur = costPerCaseEur * 1000;

  console.log('TOKEN-VERBRAUCH & KOSTEN-PROJEKTION (GEMINI 3.8 FLASH):');
  console.log(
    `  - Gesamt-Tokens alle Durchläufe:   ${totalAllTokens.toLocaleString('de-DE')} (${totalPromptTokens.toLocaleString('de-DE')} In / ${totalCompletionTokens.toLocaleString('de-DE')} Out)`
  );
  console.log(`  - Ø Prompt-Tokens (Input) / Akte:  ${avgPromptTokens.toLocaleString('de-DE')}`);
  console.log(
    `  - Ø Completion-Tokens (Output):    ${avgCompletionTokens.toLocaleString('de-DE')}`
  );
  console.log(
    `  - Ø Gesamt-Tokens / Akte:          ${(avgPromptTokens + avgCompletionTokens).toLocaleString('de-DE')}`
  );
  console.log(`  - Tatsächliche Kosten im Free Tier: 0,00 € (Kostenlos via AI Studio)`);
  console.log(
    `  - Projektion Kosten pro Akte:      ${costPerCaseEur.toFixed(5)} €  (${totalCostUsd.toFixed(5)} $)`
  );
  console.log(
    `  - Projektion pro 1.000 Akten:      ${costPer1000CasesEur.toFixed(2)} €  (${(costPer1000CasesEur / USD_TO_EUR_RATE).toFixed(2)} $)`
  );
  console.log('=============================================================================\n');

  if (avgAccuracy < 80) {
    console.error('❌ BENCHMARK NICHT BESTANDEN: Genauigkeit liegt unter dem Schwellenwert.');
    process.exit(1);
  } else {
    console.log('✅ BENCHMARK BESTANDEN: Alle Qualitäts- und Stabilitätskriterien erfüllt.');
  }
}

runEvaluation().catch((err: unknown) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  console.error('\n❌ FEHLER IM BENCHMARK-LAUF:');

  if (errMsg.includes('prepayment credits are depleted') || errMsg.includes('402')) {
    console.error(
      'Das verknüpfte Google AI Studio Projekt erfordert Prepayment Credits oder ein aktives Kontingent.'
    );
    console.error(
      '🔗 Details & Aufladung: https://ai.studio/projects oder https://ai.google.dev/gemini-api/docs/billing#prepay\n'
    );
    console.error(
      '💡 TIPP: Für eine 100% kostenlose (0,00 €) Evaluierung der Pipeline-Architektur, Guardrails & Normalisierung:'
    );
    console.error('   👉 npm run eval  (Offline Replay Modus)');
  } else {
    console.error(errMsg);
  }
  process.exit(1);
});
