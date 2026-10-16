/**
 * Sparsamer Live-Eval gegen das echte Modell (Free-Tier-tauglich).
 *
 *   npm run eval:live:runs                  # bis zu 2 Läufe für die am wenigsten gemessenen Fälle
 *   npm run eval:live:runs -- --max-runs 4 --cases fall-04-standard-urkunde
 *   npm run eval:live:report                # nur auswerten, keine Modellaufrufe
 *
 * Ergebnisse sammeln sich in reports/live-eval/runs.jsonl über Tage an. Beim ersten
 * Kontingentfehler (429) stoppt der Lauf sofort. Gate: mindestens 3 Läufe je Fall.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createGoogle } from '@ai-sdk/google';
import { runAnalysisPipeline } from '@/lib/ai/pipeline';
import {
  IMMOBILIEN_EXTRACTION_AGENT_PROMPT,
  NOTARY_AUDITOR_RECONCILER_PROMPT,
} from '@/lib/ai/prompts';
import {
  aggregateFieldErrorRates,
  createCallBudget,
  evaluateLiveGate,
  isQuotaError,
} from '@/lib/evals/live-run-stats';
import { GOLDEN_DATASET, type GoldenTestCase } from '@/test/eval/golden-dataset';
import { scoreDossierAgainstGroundTruth } from '@/test/eval/scorer';
import { createOfflineKnowledgeRepository } from '@/test/fixtures/offline-knowledge-repository';
import { EvalRunSchema, type EvalRun } from '@/types/eval';

const RUNS_FILE = path.resolve('reports/live-eval/runs.jsonl');
const DEFAULT_MAX_RUNS = 2;
const DEFAULT_DELAY_MS = 15_000;

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadRuns(): EvalRun[] {
  if (!existsSync(RUNS_FILE)) return [];
  return readFileSync(RUNS_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => EvalRunSchema.parse(JSON.parse(line)));
}

function saveRun(run: EvalRun): void {
  mkdirSync(path.dirname(RUNS_FILE), { recursive: true });
  appendFileSync(RUNS_FILE, `${JSON.stringify(run)}\n`);
}

function selectCases(runs: EvalRun[]): GoldenTestCase[] {
  const requested = readArg('cases')?.split(',');
  if (requested) return GOLDEN_DATASET.filter((tc) => requested.includes(tc.id));
  const count = (id: string) => runs.filter((r) => r.caseId === id).length;
  return [...GOLDEN_DATASET].sort((a, b) => count(a.id) - count(b.id));
}

function printReport(runs: EvalRun[]): boolean {
  const rates = aggregateFieldErrorRates(runs);
  const gate = evaluateLiveGate(rates);
  const flaky = rates.filter((r) => r.isFlaky);
  console.log(
    `Läufe gesamt: ${runs.length}, Felder: ${rates.length}, wechselhaft: ${flaky.length}`
  );
  for (const failure of gate.failures) console.log(`  ✗ ${failure}`);
  console.log(gate.passed ? 'Gate: bestanden' : 'Gate: nicht bestanden');
  return gate.passed;
}

async function runCase(
  testCase: GoldenTestCase,
  modelName: string,
  apiKey: string
): Promise<EvalRun> {
  const model = createGoogle({ apiKey })(modelName);
  const dossier = await runAnalysisPipeline({
    files: testCase.files,
    caseType: testCase.caseType,
    notes: testCase.notes,
    model,
    knowledgeRepo: createOfflineKnowledgeRepository(),
    extractionInstructions: { role: 'system', content: IMMOBILIEN_EXTRACTION_AGENT_PROMPT },
    auditorInstructions: { role: 'system', content: NOTARY_AUDITOR_RECONCILER_PROMPT },
    onStep: () => {},
  });
  const score = scoreDossierAgainstGroundTruth(testCase, dossier);
  return {
    caseId: testCase.id,
    outcomes: score.details.map((d) => ({
      caseId: testCase.id,
      fieldKey: d.fieldKey,
      matched: d.matched,
      hasProvenance: d.hasProvenance,
    })),
  };
}

async function main(): Promise<void> {
  const runs = loadRuns();
  if (process.argv.includes('--report')) {
    process.exit(printReport(runs) ? 0 : 1);
  }

  const apiKey = process.env.EVAL_GEMINI_API_KEY;
  const modelName = process.env.EVAL_GEMINI_AI_MODEL;
  if (!apiKey || !modelName) {
    throw new Error('EVAL_GEMINI_API_KEY und EVAL_GEMINI_AI_MODEL müssen gesetzt sein.');
  }

  const budget = createCallBudget(Number(readArg('max-runs') ?? DEFAULT_MAX_RUNS));
  const delayMs = Number(readArg('delay-ms') ?? DEFAULT_DELAY_MS);

  for (const testCase of selectCases(runs)) {
    if (!budget.tryConsume()) break;
    try {
      const run = await runCase(testCase, modelName, apiKey);
      saveRun(run);
      runs.push(run);
      console.log(`✓ ${testCase.id} gemessen (${budget.used()}. Lauf)`);
    } catch (error: unknown) {
      if (isQuotaError(error)) {
        console.log('Kontingent erreicht – Lauf gestoppt. Morgen weitermachen.');
        break;
      }
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  printReport(runs);
}

void main();
