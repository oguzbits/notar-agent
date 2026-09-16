import { HybridSearchQuery, HybridSearchResult, KnowledgeDocument } from '@/types/knowledge';
import { GLOBAL_NOTARY_KNOWLEDGE_DOCUMENTS } from './seed-knowledge';

/**
 * Berechnet den Kosinus-Ähnlichkeitswert zweier Vektoren (Wert zwischen 0 und 1).
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

    // Zähle Vorkommen
    let count = 0;
    let pos = lowerText.indexOf(kw);
    while (pos !== -1) {
      count++;
      pos = lowerText.indexOf(kw, pos + kw.length);
    }

    if (count > 0) {
      // Saturation curve (BM25 tf weight)
      const tf = (count * (1.2 + 1)) / (count + 1.2 * (1 - 0.75 + 0.75 * (lowerText.length / 500)));
      score += tf;
    }
  }

  return Math.round(score * 100) / 100;
}

/**
 * Führt die hybride Fusion (BM25 + Semantic Vector Similarity) durch.
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

    // Bestimme Match Source
    let matchSource: HybridSearchResult['matchSource'] = 'BM25_EXACT';
    if (bm25Score > 0 && vectorScore > 0) {
      matchSource = 'HYBRID_FUSION';
    } else if (vectorScore > 0 && bm25Score === 0) {
      matchSource = 'SEMANTIC_VECTOR';
    }

    // Normalisiere Combined Score
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

  // Sortiere absteigend nach combinedScore
  results.sort((a, b) => b.combinedScore - a.combinedScore);

  return results.slice(0, topK);
}

/**
 * Kanzlei-isoliertes Repository Interface (§ 203 StGB).
 */
export interface IKnowledgeRepository {
  search(query: HybridSearchQuery): Promise<HybridSearchResult[]>;
  save(doc: KnowledgeDocument): Promise<KnowledgeDocument>;
}

/**
 * Bounded In-Memory Repository mit hermetischer Kanzleitrennung.
 */
export class InMemoryKnowledgeRepository implements IKnowledgeRepository {
  private documents: KnowledgeDocument[] = [];

  constructor() {
    this.seed(GLOBAL_NOTARY_KNOWLEDGE_DOCUMENTS);
  }

  seed(docs: KnowledgeDocument[]): void {
    this.documents = [...docs];
  }

  async save(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    this.documents.push(doc);
    return doc;
  }

  async search(query: HybridSearchQuery): Promise<HybridSearchResult[]> {
    // 1. Kanzlei-Isolation (§ 203 StGB)
    const accessibleDocs = this.documents.filter((doc) => {
      // Wenn das Dokument global ist (organizationId === null), ist es für alle zugänglich
      if (doc.organizationId === null) return true;
      // Wenn der Query eine organizationId hat, darf nur die eigene Kanzlei zugegriffen werden
      if (query.organizationId && doc.organizationId === query.organizationId) return true;
      return false;
    });

    // 2. Kategorie-Filterung (optional)
    const filteredDocs = query.category
      ? accessibleDocs.filter((d) => d.category === query.category)
      : accessibleDocs;

    // 3. Hybride Suche
    return performHybridSearch(filteredDocs, query);
  }
}
