import { IKnowledgeRepository } from '@/lib/knowledge/knowledge-repository';
import {
  HybridSearchQuery,
  HybridSearchResult,
  KNOWLEDGE_CATEGORIES,
  KnowledgeDocument,
} from '@/types/knowledge';

/**
 * Berechnet den Kosinus-Ähnlichkeitswert zweier Vektoren (Wert zwischen 0 und 1).
 * Ausschließlich für flüchtige In-Memory-Mock-Suchen.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Deterministische Term-Frequency / Keyword-Scoring-Funktion (BM25 Approximation).
 * Ausschließlich für flüchtige In-Memory-Mock-Suchen.
 */
export function calculateBM25Score(keywords: string[], text: string): number {
  if (!keywords || keywords.length === 0 || !text) {
    return 0;
  }

  const lowerText = text.toLowerCase();
  let score = 0;

  for (const rawKeyword of keywords) {
    const kw = rawKeyword.trim().toLowerCase();
    if (!kw) continue;

    let count = 0;
    let pos = lowerText.indexOf(kw);
    while (pos !== -1) {
      count++;
      pos = lowerText.indexOf(kw, pos + kw.length);
    }

    if (count > 0) {
      const tf = (count * (1.2 + 1)) / (count + 1.2 * (1 - 0.75 + 0.75 * (lowerText.length / 500)));
      score += tf;
    }
  }

  return Math.round(score * 100) / 100;
}

/**
 * Führt die hybride In-Memory Fusion (BM25 + Semantic Vector Similarity) durch.
 */
export function performHybridSearch(
  documents: KnowledgeDocument[],
  query: HybridSearchQuery
): HybridSearchResult[] {
  const { queryText, queryEmbedding, topK = 5, vectorWeight = 0.5 } = query;
  const keywords = queryText
    .split(/\s+/)
    .map((w) => w.replace(/[^\w§äöüÄÖÜß]/g, ''))
    .filter((w) => w.length > 2);

  const results: HybridSearchResult[] = [];

  for (const doc of documents) {
    const fullDocText = `${doc.title} ${doc.content} ${doc.legalBasis} ${doc.triggerKeywords.join(' ')}`;
    const bm25Score = calculateBM25Score(keywords, fullDocText);

    let vectorScore = 0;
    if (queryEmbedding && doc.embedding) {
      vectorScore = cosineSimilarity(queryEmbedding, doc.embedding);
    }

    let matchSource: HybridSearchResult['matchSource'] = 'BM25_EXACT';
    if (bm25Score > 0 && vectorScore > 0) {
      matchSource = 'HYBRID_FUSION';
    } else if (vectorScore > 0 && bm25Score === 0) {
      matchSource = 'SEMANTIC_VECTOR';
    }

    const combinedScore =
      Math.round(((1 - vectorWeight) * bm25Score + vectorWeight * (vectorScore * 5)) * 100) / 100;

    if (combinedScore > 0) {
      results.push({
        document: doc,
        bm25Score,
        vectorScore: Math.round(vectorScore * 100) / 100,
        combinedScore,
        matchSource,
      });
    }
  }

  results.sort((a, b) => b.combinedScore - a.combinedScore);
  return results.slice(0, topK);
}

/**
 * Bounded In-Memory Repository mit hermetischer Kanzleitrennung.
 * Ausschließlich für isolierte Unit-Tests und Zero-Config-Demos bestimmt.
 */
export class InMemoryKnowledgeRepository implements IKnowledgeRepository {
  private documents: KnowledgeDocument[] = [];

  constructor(initialDocs: KnowledgeDocument[] = []) {
    if (initialDocs.length > 0) {
      this.seed(initialDocs);
    }
  }

  seed(docs: KnowledgeDocument[]): void {
    this.documents = [...docs];
  }

  async save(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    this.documents.push(doc);
    return doc;
  }

  async search(query: HybridSearchQuery): Promise<HybridSearchResult[]> {
    const accessibleDocs = this.documents.filter((doc) => {
      if (doc.organizationId === null) return true;
      if (query.organizationId && doc.organizationId === query.organizationId) return true;
      return false;
    });

    const filteredDocs = query.category
      ? accessibleDocs.filter((d) => d.category === query.category)
      : accessibleDocs;

    return performHybridSearch(filteredDocs, query);
  }

  async getStatutoryRules(organizationId?: string | null): Promise<KnowledgeDocument[]> {
    return this.documents.filter((doc) => {
      const isAccessible =
        doc.organizationId === null || (organizationId && doc.organizationId === organizationId);
      return (
        isAccessible && (doc.isGlobal || doc.category === KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM)
      );
    });
  }
}
