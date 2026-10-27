// Vergleich der Suchvarianten Volltext, Vektor, RPC-Hybrid, Gate und Score-Fusion auf den Fällen des Eval-Gates.
// Läuft nur mit eigenem Schlüssel, nie automatisch; es dürfen ausschließlich synthetische Daten an die API gehen.
//
// Kriterien (vor dem ersten Lauf festgelegt, nicht nachträglich ändern):
//  K1 Abdeckung = Anteil der einschlägigen Normen im Prompt (Schlagwortauswahl ∪ Top 3).
//  K2 Vollabdeckung = Fälle, in denen alle einschlägigen Normen im Prompt sind.
//  K3 Ein Wechsel gilt nur als belegt, wenn K1 um >= 0,08 über dem Volltext liegt UND das auch bei den
//     Fällen ohne Kennung gilt.
//  K4 Fälle ohne Treffer: nur Trennschärfe (höchste Kosinus-Ähnlichkeit), kein Erfolgsmaß.
//
// Grenze: Der Volltext läuft hier auf einer Postgres-Kopie nur mit dem Benchmark-Korpus. Das Eval-Gate
// (npm run test:db) misst die echte RPC mit den Seed-Dokumenten und liegt tiefer. Vergleiche die Varianten
// untereinander, nicht mit der Baseline des Gates.
//
// Lauf:
//   docker run -d --name evalpg -e POSTGRES_PASSWORD=pw -p 54999:5432 public.ecr.aws/supabase/postgres:17.11.0.004
//   GEMINI_API_KEY=... EMBEDDING_MODEL_ID=... npx tsx --tsconfig tsconfig.json scripts/eval/compare-retrieval-variants.ts
//   docker rm -f evalpg
// Modell-ID und Dimension (1536, passend zu knowledge_documents.embedding) vorher gegen die aktuelle Doku prüfen.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { formatInternalNotes } from '@/lib/ai/pipeline';
import { calculateDynamicWeights } from '@/lib/knowledge/dynamic-weights';
import { resolveLegalBasis } from '@/lib/knowledge/eval-gate';
import { BENCHMARK_KNOWLEDGE_CORPUS as CORPUS } from '@/lib/knowledge/fixtures/benchmark-knowledge-corpus';
import { selectApplicableKnowledge } from '@/lib/knowledge/rules/rule-selector';
import { buildKnowledgeSearchText } from '@/lib/knowledge/search-text';
import { RETRIEVAL_EVAL_CASES } from '@/test/fixtures/retrieval-eval-cases';
import { RETRIEVAL_EVAL_CASE_KINDS as KIND, RetrievalEvalCase } from '@/types/eval';
import { KNOWLEDGE_CATEGORIES } from '@/types/knowledge';

const { Client } = createRequire(`${process.cwd()}/package.json`)('pg');
const MODEL = process.env.EMBEDDING_MODEL_ID;
const KEY = process.env.GEMINI_API_KEY;
if (!MODEL || !KEY) throw new Error('EMBEDDING_MODEL_ID und GEMINI_API_KEY müssen gesetzt sein.');
const DIM = 1536;
const CACHE = process.env.EVAL_EMBED_CACHE ?? join(tmpdir(), 'retrieval-embed-cache.json');

const CD_SQL = `
WITH q AS (SELECT NULLIF(replace(plainto_tsquery('german',$1)::text,' & ',' | '),'')::tsquery AS tq)
SELECT id, ts_rank_cd(tsv, q.tq)::float AS s FROM d, q WHERE tsv @@ q.tq ORDER BY s DESC, id LIMIT 20`;

const docText = (d: (typeof CORPUS)[number]) =>
  `title: ${d.title} | text: ${d.content} ${d.legalBasis} ${d.triggerKeywords.join(' ')}`;
// Wie die Pipeline: Notizblock mit Anweisungstext, nicht die rohen Notizen.
const notesOf = (c: RetrievalEvalCase) => formatInternalNotes(c.notes).notesSection;
const queryOf = (c: RetrievalEvalCase) =>
  buildKnowledgeSearchText(c.caseType, notesOf(c), c.fileNames);
const norm = (v: number[]) => {
  const k = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / k);
};
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

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

const RRF_K = 60;
const CANDIDATES = 20;
const rrf = (text: string[], vec: string[], tw: number, vw: number) => {
  const s = new Map<string, number>();
  text.slice(0, CANDIDATES).forEach((id, i) => s.set(id, (s.get(id) ?? 0) + tw / (RRF_K + i + 1)));
  vec.slice(0, CANDIDATES).forEach((id, i) => s.set(id, (s.get(id) ?? 0) + vw / (RRF_K + i + 1)));
  return [...s.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
};

const VARIANTS = {
  cd: 'Volltext ts_rank_cd (Prod-Suche)',
  vec: 'nur Vektor',
  rpc: 'Hybrid RRF dyn. Gewichte (RPC)',
  gate: 'Gate: Text nur bei §/Zahl, sonst Vektor',
  score30: 'Score-Fusion 0.3 Text / 0.7 Vektor',
} as const;
type Variant = keyof typeof VARIANTS;

async function main() {
  const db = new Client({
    host: 'localhost',
    port: 54999,
    user: 'postgres',
    password: 'pw',
    database: 'postgres',
  });
  await db.connect();
  await db.query('DROP TABLE IF EXISTS d; CREATE TABLE d (id text primary key, tsv tsvector)');
  for (const doc of CORPUS) {
    const text = `${doc.title} ${doc.content} ${doc.legalBasis} ${doc.triggerKeywords.join(' ')}`;
    await db.query("INSERT INTO d VALUES ($1, to_tsvector('german', $2))", [doc.id, text]);
  }
  const docVecs = await embed(CORPUS.map(docText));
  const qVecs = await embed(
    RETRIEVAL_EVAL_CASES.map((c) => `task: search result | query: ${queryOf(c)}`)
  );
  const statutory = CORPUS.filter((d) => d.category === KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM);

  interface Row {
    c: RetrievalEvalCase;
    relevant: string[];
    selected: Set<string>;
    top1Cos: number;
    inPrompt: Record<Variant, number>;
  }
  const rows: Row[] = [];
  for (const [ci, c] of RETRIEVAL_EVAL_CASES.entries()) {
    const query = queryOf(c);
    const cdRows = (await db.query(CD_SQL, [query])).rows as { id: string; s: number }[];
    const idsCd = cdRows.map((r) => r.id);
    const tNorm = new Map(cdRows.map((r) => [r.id, r.s / (cdRows[0]?.s ?? 1)]));
    const cos = CORPUS.map((d, i) => ({
      id: d.id,
      s: dot(qVecs[ci] as number[], docVecs[i] as number[]),
    }));
    const lo = Math.min(...cos.map((x) => x.s));
    const hi = Math.max(...cos.map((x) => x.s));
    const vNorm = new Map(cos.map((x) => [x.id, (x.s - lo) / (hi - lo)]));
    const idsVec = [...cos].sort((a, b) => b.s - a.s).map((x) => x.id);
    const w = calculateDynamicWeights(query);
    const score30 = CORPUS.map((d) => ({
      id: d.id,
      s: 0.3 * (tNorm.get(d.id) ?? 0) + 0.7 * (vNorm.get(d.id) ?? 0),
    }))
      .sort((x, y) => y.s - x.s || (x.id < y.id ? -1 : 1))
      .map((x) => x.id);
    const order: Record<Variant, string[]> = {
      cd: idsCd,
      vec: idsVec,
      rpc: rrf(idsCd, idsVec, w.textWeight, w.vectorWeight),
      gate: w.textWeight >= 0.85 ? rrf(idsCd, idsVec, 0.85, 0.15) : idsVec,
      score30,
    };
    const selected = new Set(
      selectApplicableKnowledge(statutory, {
        caseType: c.caseType,
        detectedDocuments: c.fileNames.map((fileName) => ({ fileName })),
        notes: notesOf(c),
      }).map((d) => d.id)
    );
    const relevant = c.relevantLegalBases.map((b) => resolveLegalBasis(CORPUS, b).id);
    const inPrompt = Object.fromEntries(
      (Object.keys(VARIANTS) as Variant[]).map((v) => {
        const top3 = new Set(order[v].slice(0, 3));
        return [
          v,
          relevant.filter((id) => selected.has(id) || top3.has(id)).length / (relevant.length || 1),
        ];
      })
    ) as Record<Variant, number>;
    rows.push({ c, relevant, selected, top1Cos: Math.max(...cos.map((x) => x.s)), inPrompt });
  }

  const report = (title: string, set: Row[]) => {
    console.log(`\n== ${title} (n=${set.length}) ==`);
    const sel =
      set.reduce(
        (s, r) => s + r.relevant.filter((id) => r.selected.has(id)).length / r.relevant.length,
        0
      ) / set.length;
    console.log(`  ${'Schlagwort-Auswahl allein'.padEnd(42)} K1 ${sel.toFixed(2)}`);
    for (const v of Object.keys(VARIANTS) as Variant[]) {
      const k1 = set.reduce((s, r) => s + r.inPrompt[v], 0) / set.length;
      const k2 = set.filter((r) => r.inPrompt[v] === 1).length;
      console.log(
        `  ${VARIANTS[v].padEnd(42)} K1 ${k1.toFixed(2)}  K2 ${String(k2).padStart(2)}/${set.length}`
      );
    }
  };
  const matched = rows.filter((r) => r.c.kind !== KIND.OHNE_TREFFER);
  report('Alle mit Treffer', matched);
  report(
    'Mit Kennung',
    rows.filter((r) => r.c.kind === KIND.KENNUNG)
  );
  report(
    'Ohne Kennung',
    rows.filter((r) => r.c.kind === KIND.OHNE_KENNUNG)
  );

  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const m = matched.map((r) => r.top1Cos);
  const nm = rows.filter((r) => r.c.kind === KIND.OHNE_TREFFER).map((r) => r.top1Cos);
  console.log(
    `\nK4 Trennschärfe: mit Treffer Ø ${mean(m).toFixed(3)} (min ${Math.min(...m).toFixed(3)}), ohne Treffer Ø ${mean(nm).toFixed(3)} (max ${Math.max(...nm).toFixed(3)})`
  );
  await db.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
