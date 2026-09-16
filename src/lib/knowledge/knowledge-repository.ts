import { HybridSearchQuery, HybridSearchResult, KnowledgeDocument } from '@/types/knowledge';

/**
 * Kanzlei-isoliertes Knowledge Repository Interface (§ 203 StGB).
 */
export interface IKnowledgeRepository {
  search(query: HybridSearchQuery): Promise<HybridSearchResult[]>;
  save(doc: KnowledgeDocument): Promise<KnowledgeDocument>;
}
