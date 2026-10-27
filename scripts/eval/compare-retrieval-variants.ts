// Vergleich der Suchvarianten Volltext, Vektor, Hybrid und Gate auf den Fällen des Eval-Gates.
// Misst wie das Eval-Gate die echte RPC match_knowledge_documents der lokalen Supabase (mit Seed-Dokumenten),
// nicht eine Nachbildung. Läuft nur mit eigenem Schlüssel, nie automatisch; es gehen ausschließlich
// synthetische Daten an die API.
//
// Kriterien (vor dem ersten Lauf festgelegt, nicht nachträglich ändern):
//  K1 Abdeckung = Anteil der einschlägigen Normen im Prompt (Schlagwortauswahl ∪ Top 3).
//  K2 Vollabdeckung = Fälle, in denen alle einschlägigen Normen im Prompt sind.
//  K3 Ein Wechsel gilt nur als belegt, wenn K1 um >= 0,08 über dem Volltext liegt UND das auch bei den
//     Fällen ohne Kennung gilt.
//  K4 Fälle ohne Treffer: nur Trennschärfe (höchster Vektor-Score), kein Erfolgsmaß.
//
// Die Varianten sind direkt mit der Baseline des Gates vergleichbar (Variante "Volltext" = Produktion).
// Das Skript setzt für die Dauer des Laufs Embeddings an allen sichtbaren Dokumenten der lokalen Datenbank
// und setzt sie am Ende wieder auf NULL zurück (Produktionszustand: keine Dokumentvektoren).
//
// Lauf (lokale Supabase mit `npx supabase start`):
//   GEMINI_API_KEY=... EMBEDDING_MODEL_ID=... npx tsx --tsconfig tsconfig.json scripts/eval/compare-retrieval-variants.ts
// Modell-ID und Dimension (1536, passend zu knowledge_documents.embedding) vorher gegen die aktuelle Doku prüfen.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { formatInternalNotes } from '@/lib/ai/pipeline';
import { calculateDynamicWeights } from '@/lib/knowledge/dynamic-weights';
import { resolveLegalBasis } from '@/lib/knowledge/eval-gate';
import { BENCHMARK_KNOWLEDGE_CORPUS as CORPUS } from '@/lib/knowledge/fixtures/benchmark-knowledge-corpus';
import { selectApplicableKnowledge } from '@/lib/knowledge/rules/rule-selector';
import { buildKnowledgeSearchText } from '@/lib/knowledge/search-text';
import { SupabaseKnowledgeRepository } from '@/lib/knowledge/supabase-knowledge-repository';
import { createDbHarness } from '@/test/db/db-harness';
import { RETRIEVAL_EVAL_CASES } from '@/test/fixtures/retrieval-eval-cases';
import { DB_TABLES } from '@/types/database';
import { RETRIEVAL_EVAL_CASE_KINDS as KIND, RetrievalEvalCase } from '@/types/eval';

const MODEL = process.env.EMBEDDING_MODEL_ID;
const KEY = process.env.GEMINI_API_KEY;
if (!MODEL || !KEY) throw new Error('EMBEDDING_MODEL_ID und GEMINI_API_KEY müssen gesetzt sein.');
const DIM = 1536;
const TOP_K = 3;
const CACHE = process.env.EVAL_EMBED_CACHE ?? join(tmpdir(), 'retrieval-embed-cache.json');

const norm = (v: number[]) => {
  const k = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / k);
};

async function embed(texts: string[]): Promise<number[][]> {
  const cache: Record<string, number[]> = existsSync(CACHE)
    ? JSON.parse(readFileSync(CACHE, 'utf8'))
    : {};
  const todo = [...new Set(texts.filter((t) => !cache[t]))];
  for (let i = 0; i < todo.length; i += 16) {
    const batch = todo.slice(i, i + 16);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': KEY as string, 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: DIM,
          })),
        }),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { embeddings: { values: number[] }[] };
    if (body.embeddings.length !== batch.length)
      throw new Error('Anzahl der Embeddings passt nicht');
    batch.forEach((t, j) => {
      const v = body.embeddings[j]?.values ?? [];
      if (v.length !== DIM) throw new Error(`Dimension ${v.length}`);
      cache[t] = norm(v);
    });
    writeFileSync(CACHE, JSON.stringify(cache));
    await sleep(3000);
  }
  return texts.map((t) => cache[t] as number[]);
}

const VARIANTS = {
  cd: 'Volltext (Produktion)',
  vec: 'nur Vektor',
  rpc: 'Hybrid RRF dyn. Gewichte',
  gate: 'Gate: Text nur bei §/Zahl, sonst Vektor',
} as const;
type Variant = keyof typeof VARIANTS;

interface DocRow {
  id: string;
  title: string;
  content: string;
  legal_basis: string;
  trigger_keywords: string[];
}

async function main() {
  const harness = createDbHarness();
  const user = await harness.createUser();
  const orgId = await harness.createOrganizationWithMember(user.id);
  const repo = new SupabaseKnowledgeRepository(user.client as never);
  const table = harness.admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS);

  const inserted = await table.insert(
    CORPUS.map((doc) => ({
      organization_id: orgId,
      category: doc.category,
      legal_basis: doc.legalBasis,
      court_or_authority: doc.courtOrAuthority ?? null,
      title: doc.title,
      content: doc.content,
      trigger_keywords: doc.triggerKeywords,
    }))
  );
  if (inserted.error) throw inserted.error;

  // Alle für die Organisation sichtbaren Dokumente (Seeds und Kopie des Korpus) erhalten Vektoren.
  const docs = await harness.admin
    .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
    .select('id,title,content,legal_basis,trigger_keywords')
    .or(`organization_id.is.null,organization_id.eq.${orgId}`);
  if (docs.error) throw docs.error;
  const rows = docs.data as DocRow[];
  const touched = rows.map((r) => r.id);

  try {
    const docVecs = await embed(
      rows.map(
        (d) =>
          `title: ${d.title} | text: ${d.content} ${d.legal_basis} ${d.trigger_keywords.join(' ')}`
      )
    );
    for (const [i, d] of rows.entries()) {
      const upd = await harness.admin
        .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
        .update({ embedding: JSON.stringify(docVecs[i]) })
        .eq('id', d.id);
      if (upd.error) throw upd.error;
    }

    const notesOf = (c: RetrievalEvalCase) => formatInternalNotes(c.notes).notesSection;
    const queryOf = (c: RetrievalEvalCase) =>
      buildKnowledgeSearchText(c.caseType, notesOf(c), c.fileNames);
    const qVecs = await embed(
      RETRIEVAL_EVAL_CASES.map((c) => `task: search result | query: ${queryOf(c)}`)
    );
    const statutory = await repo.getStatutoryRules(orgId);

    interface Row {
      c: RetrievalEvalCase;
      selectedCount: number;
      relevantCount: number;
      top1Vector: number;
      inPrompt: Record<Variant, number>;
    }
    const results: Row[] = [];
    for (const [ci, c] of RETRIEVAL_EVAL_CASES.entries()) {
      const query = queryOf(c);
      const emb = qVecs[ci] as number[];
      const search = (queryText: string, vectorWeight: number, withVector: boolean) =>
        repo.search({
          queryText,
          queryEmbedding: withVector ? emb : undefined,
          organizationId: orgId,
          topK: TOP_K,
          vectorWeight,
          textWeight: 1 - vectorWeight,
        });
      const w = calculateDynamicWeights(query);
      const hits: Record<Variant, Awaited<ReturnType<typeof search>>> = {
        cd: await search(query, 0, false),
        vec: await search('', 1, true),
        rpc: await search(query, w.vectorWeight, true),
        gate: w.textWeight >= 0.85 ? await search(query, 0.15, true) : await search('', 1, true),
      };
      const selected = selectApplicableKnowledge(statutory, {
        caseType: c.caseType,
        detectedDocuments: c.fileNames.map((fileName) => ({ fileName })),
        notes: notesOf(c),
      });
      const selectedBases = new Set(selected.map((d) => d.legalBasis));
      const relevant = c.relevantLegalBases.map((b) => resolveLegalBasis(CORPUS, b).legalBasis);
      const inPrompt = Object.fromEntries(
        (Object.keys(VARIANTS) as Variant[]).map((v) => {
          const bases = new Set(hits[v].map((h) => h.document.legalBasis));
          return [
            v,
            relevant.filter((b) => selectedBases.has(b) || bases.has(b)).length /
              (relevant.length || 1),
          ];
        })
      ) as Record<Variant, number>;
      results.push({
        c,
        selectedCount: relevant.filter((b) => selectedBases.has(b)).length,
        relevantCount: relevant.length,
        top1Vector: hits.vec[0]?.vectorScore ?? 0,
        inPrompt,
      });
    }

    const report = (title: string, set: Row[]) => {
      console.log(`\n== ${title} (n=${set.length}) ==`);
      const sel = set.reduce((s, r) => s + r.selectedCount / r.relevantCount, 0) / set.length;
      console.log(`  ${'Schlagwort-Auswahl allein'.padEnd(42)} K1 ${sel.toFixed(2)}`);
      for (const v of Object.keys(VARIANTS) as Variant[]) {
        const k1 = set.reduce((s, r) => s + r.inPrompt[v], 0) / set.length;
        const k2 = set.filter((r) => r.inPrompt[v] === 1).length;
        console.log(
          `  ${VARIANTS[v].padEnd(42)} K1 ${k1.toFixed(2)}  K2 ${String(k2).padStart(2)}/${set.length}`
        );
      }
    };
    const matched = results.filter((r) => r.c.kind !== KIND.OHNE_TREFFER);
    report('Alle mit Treffer', matched);
    report(
      'Mit Kennung',
      results.filter((r) => r.c.kind === KIND.KENNUNG)
    );
    report(
      'Ohne Kennung',
      results.filter((r) => r.c.kind === KIND.OHNE_KENNUNG)
    );

    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const m = matched.map((r) => r.top1Vector);
    const nm = results.filter((r) => r.c.kind === KIND.OHNE_TREFFER).map((r) => r.top1Vector);
    console.log(
      `\nK4 Trennschärfe: mit Treffer Ø ${mean(m).toFixed(3)} (min ${Math.min(...m).toFixed(3)}), ohne Treffer Ø ${mean(nm).toFixed(3)} (max ${Math.max(...nm).toFixed(3)})`
    );
  } finally {
    // Produktionszustand wiederherstellen: keine Dokumentvektoren, keine Kopie des Korpus.
    await harness.admin
      .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
      .update({ embedding: null })
      .in('id', touched);
    await harness.admin.from(DB_TABLES.KNOWLEDGE_DOCUMENTS).delete().eq('organization_id', orgId);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
