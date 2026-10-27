import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatInternalNotes } from '@/lib/ai/pipeline';
import {
  compareToBaseline,
  resolveLegalBasis,
  summarizeRetrievalEval,
} from '@/lib/knowledge/eval-gate';
import { BENCHMARK_KNOWLEDGE_CORPUS } from '@/lib/knowledge/fixtures/benchmark-knowledge-corpus';
import { selectApplicableKnowledge } from '@/lib/knowledge/rules/rule-selector';
import { buildKnowledgeSearchText } from '@/lib/knowledge/search-text';
import { SupabaseKnowledgeRepository } from '@/lib/knowledge/supabase-knowledge-repository';
import { RETRIEVAL_EVAL_CASES } from '@/test/fixtures/retrieval-eval-cases';
import { DB_TABLES } from '@/types/database';
import { RetrievalEvalBaselineSchema, RetrievalEvalResult } from '@/types/eval';
import { createDbHarness, type TestUser } from './db-harness';

const TOP_K = 3;
const BASELINE_PATH = 'src/test/fixtures/retrieval-eval-baseline.json';
/** Nur bewusst setzen: schreibt den gemessenen Stand als neue Baseline. */
const UPDATE_BASELINE = process.env.UPDATE_EVAL_BASELINE === '1';

describe('Eval-Gate der Wissenssuche (produktionsnah)', () => {
  let user: TestUser;
  let orgId: string;

  beforeAll(async () => {
    const harness = createDbHarness();
    user = await harness.createUser();
    orgId = await harness.createOrganizationWithMember(user.id);
    const rows = BENCHMARK_KNOWLEDGE_CORPUS.map((doc) => ({
      id: randomUUID(),
      organization_id: orgId,
      category: doc.category,
      legal_basis: doc.legalBasis,
      court_or_authority: doc.courtOrAuthority ?? null,
      title: doc.title,
      content: doc.content,
      trigger_keywords: doc.triggerKeywords,
    }));
    const inserted = await harness.admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS).insert(rows);
    expect(inserted.error).toBeNull();
  });

  it('hält die Abdeckung der Prüfgrundlage gegenüber der Baseline', async () => {
    const repo = new SupabaseKnowledgeRepository(user.client as never);
    const statutory = await repo.getStatutoryRules(orgId);
    const results: RetrievalEvalResult[] = [];

    for (const testCase of RETRIEVAL_EVAL_CASES) {
      // Wie die Pipeline: der Notizblock samt Anweisungstext geht in Auswahl und Suche.
      const { notesSection } = formatInternalNotes(testCase.notes);
      const selected = selectApplicableKnowledge(statutory, {
        caseType: testCase.caseType,
        detectedDocuments: testCase.fileNames.map((fileName) => ({ fileName })),
        notes: notesSection,
      });
      const hits = await repo.search({
        queryText: buildKnowledgeSearchText(testCase.caseType, notesSection, testCase.fileNames),
        organizationId: orgId,
        topK: TOP_K,
      });
      const inPrompt = new Set([
        ...selected.map((d) => d.legalBasis),
        ...hits.map((h) => h.document.legalBasis),
      ]);
      const relevant = testCase.relevantLegalBases.map(
        (basis) => resolveLegalBasis(BENCHMARK_KNOWLEDGE_CORPUS, basis).legalBasis
      );
      results.push({
        caseId: testCase.id,
        kind: testCase.kind,
        relevantCount: relevant.length,
        coveredCount: relevant.filter((basis) => inPrompt.has(basis)).length,
      });
    }

    const summary = summarizeRetrievalEval(results);
    if (UPDATE_BASELINE) {
      const baseline = { ...summary, date: new Date().toISOString().slice(0, 10) };
      writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
      return;
    }
    if (!existsSync(BASELINE_PATH)) {
      throw new Error(
        `Baseline fehlt (${BASELINE_PATH}). Bewusst erzeugen mit UPDATE_EVAL_BASELINE=1.`
      );
    }
    const baseline = RetrievalEvalBaselineSchema.parse(
      JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    );
    expect(summary.cases).toBe(baseline.cases);
    expect(compareToBaseline(summary, baseline)).toEqual([]);
  });
});
