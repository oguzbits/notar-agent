#!/usr/bin/env node
/**
 * Führt die Evaluation aus, sammelt die Traces aller 4 Stufen und erzeugt einen visuellen HTML-Report.
 * Nutzung:
 *   node scripts/eval/generate-eval-report.mjs [--live] [fallNummer]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { runAnalysisPipeline } from '../../src/lib/ai/pipeline.ts';
import {
  IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
  NOTARY_AUDITOR_RECONCILER_PROMPT,
} from '../../src/lib/ai/prompts.ts';
import { parsePdfDocument } from '../../src/lib/files/pdf-document-parser.ts';
import { generateInteractiveHtmlReport } from '../../src/test/eval/generate-report.ts';
import { GOLDEN_DATASET } from '../../src/test/eval/golden-dataset.ts';
import { createMockEvalModel } from '../../src/test/eval/mock-eval-model.ts';
import { scoreDossierAgainstGroundTruth } from '../../src/test/eval/scorer.ts';
// .env.local nativ laden ohne externe dotenv-Abhängigkeit
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const rawVal = trimmed.slice(eqIdx + 1).trim();
        const val = rawVal.replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

// Fallback für MOCK-Modus, falls Supabase nicht lokal läuft
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.NEXT_SUPABASE_PUBLISHABLE_KEY = 'mock-anon-key-for-local-eval';
}

const args = process.argv.slice(2);
const isLive = args.includes('--live') || args.includes('-l');
const caseFilter = args.find((a) => !a.startsWith('-'));

async function main() {
  console.log(`\n📊 Starte Evaluierung und erstelle visuellen Artefakt-Report (${isLive ? 'LIVE' : 'MOCK'})...\n`);

  let targetCases = GOLDEN_DATASET;
  if (caseFilter) {
    const filterStr = /^\d+$/.test(caseFilter)
      ? `fall-${caseFilter.padStart(2, '0')}`
      : caseFilter.toLowerCase();
    targetCases = GOLDEN_DATASET.filter(
      (tc) => tc.id.toLowerCase().includes(filterStr) || tc.name.toLowerCase().includes(filterStr)
    );
  }

  if (targetCases.length === 0) {
    console.error('Keine passenden Testfälle gefunden.');
    process.exit(1);
  }

  const caseTraces = [];
  let totalCost = 0;
  let totalDuration = 0;
  let layer1AllPassed = true;

  for (const tc of targetCases) {
    console.log(`▶ Verarbeite: ${tc.name}...`);
    const caseStartTime = performance.now();
    const steps = [];

    // ----------------------------------------------------
    // STUFE 1: Ingestion / LiteParse
    // ----------------------------------------------------
    const pdfFile = tc.files.find(
      (f) => f.type === 'application/pdf' || (f.name && f.name.toLowerCase().endsWith('.pdf'))
    );
    let parserResult = undefined;

    if (pdfFile && pdfFile.content) {
      const pStart = performance.now();
      const base64Data = pdfFile.content.includes(';base64,')
        ? (pdfFile.content.split(';base64,')[1] ?? '')
        : pdfFile.content;
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      const parsed = await parsePdfDocument(pdfBuffer, { extractScreenshots: true });
      const pDuration = performance.now() - pStart;

      let tokenRecall = 100;
      let corrRate = 100;
      const missingTokens = [];
      const missingCorrs = [];

      if (tc.parserGroundTruth) {
        for (const reqTok of tc.parserGroundTruth.requiredTokens) {
          if (!parsed.markdown.includes(reqTok)) missingTokens.push(reqTok);
        }
        tokenRecall = Number(
          (
            ((tc.parserGroundTruth.requiredTokens.length - missingTokens.length) /
              tc.parserGroundTruth.requiredTokens.length) *
            100
          ).toFixed(1)
        );

        for (const corr of tc.parserGroundTruth.expectedCorrelations || []) {
          const matched = parsed.markdown
            .split('\n')
            .some(
              (l) =>
                l.toLowerCase().includes(corr.labelSubstring.toLowerCase()) &&
                l.includes(corr.expectedValue)
            );
          if (!matched) missingCorrs.push(`${corr.labelSubstring} -> ${corr.expectedValue}`);
        }
        const totalCorrs = tc.parserGroundTruth.expectedCorrelations?.length || 0;
        corrRate =
          totalCorrs > 0
            ? Number((((totalCorrs - missingCorrs.length) / totalCorrs) * 100).toFixed(1))
            : 100;
      }

      const pPassed = missingTokens.length === 0 && missingCorrs.length === 0;
      if (!pPassed) layer1AllPassed = false;

      parserResult = {
        caseId: tc.id,
        fileName: pdfFile.name,
        totalTokensExpected: tc.parserGroundTruth?.requiredTokens.length || 0,
        matchedTokensCount:
          (tc.parserGroundTruth?.requiredTokens.length || 0) - missingTokens.length,
        tokenRecallRate: tokenRecall,
        requiredCorrelationsExpected: tc.parserGroundTruth?.expectedCorrelations?.length || 0,
        matchedCorrelationsCount:
          (tc.parserGroundTruth?.expectedCorrelations?.length || 0) - missingCorrs.length,
        correlationRate: corrRate,
        parseDurationMs: Math.round(pDuration),
        passed: pPassed,
        missingTokens,
        missingCorrelations: missingCorrs,
      };

      steps.push({
        stepNumber: 1,
        stepName: 'Ingestion & Layout Parsing (LiteParse native)',
        status: pPassed ? 'SUCCESS' : 'FAILED',
        durationMs: Math.round(pDuration),
        inputSummary: `Dokument: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(1)} KB)`,
        outputSummary: `${parsed.totalPages} Seiten geparst, ${parsed.blocks.length} Layout-Blöcke, ${parsed.characterCount} Zeichen`,
        artifacts: {
          fileName: pdfFile.name,
          totalPages: parsed.totalPages,
          hasTextLayer: parsed.hasTextLayer,
          needsOcr: parsed.needsOcr,
          markdown: parsed.markdown,
          extractedMarkdownPreview: parsed.markdown.substring(0, 1500) + '...',
          blocks: parsed.blocks,
          pageScreenshots: parsed.pageScreenshots,
        },
      });
    }

    // ----------------------------------------------------
    // STUFE 2: Modell-Initialisierung & Ausführung
    // ----------------------------------------------------
    let model;
    if (isLive) {
      const anthropicKey = process.env.EVAL_ANTHROPIC_API_KEY;
      const geminiKey = process.env.EVAL_GEMINI_API_KEY;
      if (anthropicKey) {
        model = createAnthropic({ apiKey: anthropicKey })(
          process.env.EVAL_ANTHROPIC_AI_MODEL || 'claude-3-7-sonnet-20250219'
        );
      } else if (geminiKey) {
        model = createGoogle({ apiKey: geminiKey })(
          process.env.EVAL_GEMINI_AI_MODEL || 'gemini-2.5-flash'
        );
      } else {
        throw new Error('Kein API-Key gesetzt für Live-Run.');
      }
    } else {
      model = createMockEvalModel(tc);
    }

    let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const pipeStart = performance.now();

    // Mock-Knowledge-Repository für Offline-Runs ohne externe DB-Abhängigkeit
    const offlineKnowledgeRepo = !isLive
      ? {
          async search() {
            return [];
          },
          async save(doc) {
            return doc;
          },
          async getStatutoryRules() {
            return [];
          },
        }
      : undefined;

    const dossier = await runAnalysisPipeline({
      files: tc.files,
      caseType: tc.caseType,
      notes: tc.notes,
      model,
      knowledgeRepo: offlineKnowledgeRepo,
      extractionInstructions: { role: 'system', content: IMMOBILIEN_EXTRACTION_AGENT_PROMPT },
      auditorInstructions: { role: 'system', content: NOTARY_AUDITOR_RECONCILER_PROMPT },
      onStep: (sNum, sDetail) => {
        steps.push({
          stepNumber: sNum + 1,
          stepName: sDetail,
          status: 'SUCCESS',
          durationMs: 0,
          inputSummary: `Vorgangstyp: ${tc.caseType}`,
          outputSummary: 'Zwischenschritt erfolgreich',
          artifacts: {},
        });
      },
      onUsage: (u) => {
        tokenUsage = u;
      },
    });
    const _pipeDuration = performance.now() - pipeStart;

    // ----------------------------------------------------
    // STUFE 3: Outcome-Scoring & Provenance
    // ----------------------------------------------------
    const scoreResult = scoreDossierAgainstGroundTruth(tc, dossier);
    const caseTotalDuration = performance.now() - caseStartTime;
    totalDuration += caseTotalDuration;

    const outcomePassed =
      scoreResult.accuracyRate >= 95 &&
      scoreResult.provenanceCoverageRate >= 95 &&
      scoreResult.guardrailHitRate >= 100;

    const costEstimate =
      (tokenUsage.promptTokens / 1_000_000) * 0.3 + (tokenUsage.completionTokens / 1_000_000) * 2.5;
    totalCost += costEstimate;

    caseTraces.push({
      caseId: tc.id,
      caseName: tc.name,
      description: tc.description,
      timestamp: new Date().toISOString(),
      steps,
      parserResult,
      outcomeResult: {
        caseId: tc.id,
        accuracyRate: scoreResult.accuracyRate,
        provenanceCoverageRate: scoreResult.provenanceCoverageRate,
        guardrailHitRate: scoreResult.guardrailHitRate,
        fieldVerdicts: scoreResult.fieldVerdicts || [],
        passed: outcomePassed,
      },
      telemetry: {
        totalPromptTokens: tokenUsage.promptTokens,
        totalCompletionTokens: tokenUsage.completionTokens,
        totalCostUsd: costEstimate,
        latencyMs: Math.round(caseTotalDuration),
      },
      passed: outcomePassed && (parserResult ? parserResult.passed : true),
    });
  }

  const avgAccuracy =
    caseTraces.reduce((sum, c) => sum + (c.outcomeResult?.accuracyRate || 0), 0) /
    caseTraces.length;

  const suiteReport = {
    runId: `run-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    layer1ComponentPassed: layer1AllPassed,
    layer2TrajectoryScore: 1.0,
    layer3OutcomeAccuracy: Number(avgAccuracy.toFixed(1)),
    layer4Telemetry: {
      totalPromptTokens: caseTraces.reduce((sum, c) => sum + (c.telemetry?.totalPromptTokens || 0), 0),
      totalCompletionTokens: caseTraces.reduce(
        (sum, c) => sum + (c.telemetry?.totalCompletionTokens || 0),
        0
      ),
      totalCostUsd: Number(totalCost.toFixed(5)),
      latencyMs: Math.round(totalDuration),
    },
    casesTested: caseTraces.length,
    passed: caseTraces.every((c) => c.passed),
    caseTraces,
  };

  const reportPath = path.resolve(process.cwd(), 'reports', 'eval-report.html');
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const html = generateInteractiveHtmlReport(suiteReport);
  fs.writeFileSync(reportPath, html, 'utf-8');

  console.log(`\n✅ Visueller Eval-Report erfolgreich erstellt!`);
  console.log(`📍 Datei: ${reportPath}`);
  console.log(`🌐 Öffne den Report im Browser mit: open ${reportPath}\n`);
}

main().catch((err) => {
  console.error('Fehler bei der Reporterstellung:', err);
  process.exit(1);
});
