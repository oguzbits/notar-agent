// Befüllt die Dokumentvektoren der Wissensbasis (knowledge_documents.embedding).
//
//   NEXT_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... EMBEDDING_MODEL_ID=... \
//     npx tsx --tsconfig tsconfig.json scripts/knowledge/embed-documents.ts [--dry-run] [--all]
//
// Ohne --all nur Dokumente ohne Vektor; --all bettet alles neu ein (nach einem Modellwechsel,
// die Vektorräume verschiedener Modelle sind nicht vergleichbar). Schreibt in die Datenbank, auf die
// NEXT_SUPABASE_URL zeigt; gegen die Live-Datenbank nur nach ausdrücklicher Freigabe ausführen.
import { createClient } from '@supabase/supabase-js';
import { createGeminiEmbedder } from '@/lib/knowledge/embedder';
import { SupabaseKnowledgeRepository } from '@/lib/knowledge/supabase-knowledge-repository';
import type { Database } from '@/types/database';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} muss gesetzt sein.`);
  return value;
}

const dryRun = process.argv.includes('--dry-run');
const all = process.argv.includes('--all');

async function main() {
  const repo = new SupabaseKnowledgeRepository(
    createClient<Database>(requireEnv('NEXT_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
  );
  const docs = await repo.listForEmbedding({ all });
  console.log(`${docs.length} Dokument(e) ${all ? 'insgesamt' : 'ohne Vektor'}.`);

  if (!dryRun && docs.length > 0) {
    const embedder = createGeminiEmbedder(
      requireEnv('EMBEDDING_MODEL_ID'),
      requireEnv('GEMINI_API_KEY')
    );
    const vectors = await embedder.embedDocuments(docs);
    for (const [i, doc] of docs.entries()) {
      const vector = vectors[i];
      if (!vector) throw new Error(`Kein Vektor für Dokument ${doc.id}.`);
      await repo.saveEmbedding(doc.id, vector);
    }
    console.log(`${docs.length} Vektor(en) gespeichert.`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
