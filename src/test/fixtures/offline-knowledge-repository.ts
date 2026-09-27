import type { IKnowledgeRepository } from '@/lib/knowledge/knowledge-repository';
import type { KnowledgeDocument } from '@/types/knowledge';
import { KNOWLEDGE_CATEGORIES, MATCH_SOURCES } from '@/types/knowledge';
import seedKnowledgeData from './seed-knowledge.json';

/**
 * Erstellt ein isoliertes Offline-Knowledge-Repository, das auf der kanonischen Seed-Fixture basiert.
 * Frei von vitest-Abhängigkeiten, damit es sowohl in Unit-Tests als auch in Promptfoo / Node-Skripten läuft.
 * Zero hardcoded domain rules in code: Alle Normen stammen aus seed-knowledge.json.
 */
export function createOfflineKnowledgeRepository(
  initialDocs: KnowledgeDocument[] = seedKnowledgeData as unknown as KnowledgeDocument[]
): IKnowledgeRepository {
  const docs = [...initialDocs];

  return {
    async search(query: { queryText?: string }) {
      const q = (query.queryText || '').toLowerCase();
      const matches = docs.filter(
        (doc) =>
          doc.triggerKeywords.some((k) => q.includes(k.toLowerCase())) ||
          doc.content.toLowerCase().includes(q) ||
          doc.title.toLowerCase().includes(q)
      );

      return matches.map((document) => ({
        document,
        bm25Score: 1.0,
        vectorScore: 1.0,
        combinedScore: 1.0,
        matchSource: MATCH_SOURCES.BM25_EXACT,
      }));
    },
    async save(doc: KnowledgeDocument) {
      docs.push(doc);
      return doc;
    },
    async getStatutoryRules() {
      return docs.filter((d) => d.category === KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM);
    },
  };
}
