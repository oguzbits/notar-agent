import { SupabaseClient } from '@supabase/supabase-js';
import { IKnowledgeRepository, InMemoryKnowledgeRepository } from '@/lib/knowledge/hybrid-search';
import { HybridSearchQuery, HybridSearchResult, KnowledgeDocument } from '@/types/knowledge';

/**
 * Supabase Knowledge Repository mit In-Memory Fallback für Zero-Config Portabilität.
 * Unterstützt pgvector und BM25 Text-Suche unter Wahrung von § 203 StGB.
 */
export class SupabaseKnowledgeRepository implements IKnowledgeRepository {
  private supabase: SupabaseClient | null;
  private fallbackRepo: InMemoryKnowledgeRepository | null;

  constructor(
    supabaseClient: SupabaseClient | null = null,
    fallbackRepo: InMemoryKnowledgeRepository | null = null
  ) {
    this.supabase = supabaseClient;
    // Wenn kein Supabase-Client vorhanden ist, wird die lokale In-Memory-Instanz aktiv
    this.fallbackRepo = !supabaseClient
      ? (fallbackRepo ?? new InMemoryKnowledgeRepository())
      : null;
  }

  async save(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    if (!this.supabase) {
      if (!this.fallbackRepo) {
        throw new Error(
          'Supabase client is not configured and no in-memory repository is available.'
        );
      }
      return this.fallbackRepo.save(doc);
    }

    const payload: Record<string, unknown> = {
      id: doc.id,
      organization_id: doc.organizationId,
      category: doc.category,
      legal_basis: doc.legalBasis,
      court_or_authority: doc.courtOrAuthority ?? null,
      title: doc.title,
      content: doc.content,
      trigger_keywords: doc.triggerKeywords,
      embedding: doc.embedding ?? null,
    };

    const { data, error } = await this.supabase
      .from('knowledge_documents')
      .upsert(payload)
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(
        `Supabase knowledge save fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    return doc;
  }

  async search(query: HybridSearchQuery): Promise<HybridSearchResult[]> {
    if (!this.supabase) {
      if (!this.fallbackRepo) {
        throw new Error(
          'Supabase client is not configured and no in-memory repository is available.'
        );
      }
      return this.fallbackRepo.search(query);
    }

    const { data, error } = await this.supabase.rpc('match_knowledge_documents', {
      p_query_text: query.queryText,
      p_query_embedding: query.queryEmbedding ?? null,
      p_organization_id: query.organizationId ?? null,
      p_category: query.category ?? null,
      p_match_count: query.topK ?? 5,
      p_vector_weight: query.vectorWeight ?? 0.5,
    });

    if (error || !data) {
      throw new Error(
        `Supabase knowledge search fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    const rows = data as Record<string, unknown>[];

    return rows.map((row) => ({
      document: {
        id: String(row.id),
        organizationId: row.organization_id ? String(row.organization_id) : null,
        category: row.category as KnowledgeDocument['category'],
        legalBasis: String(row.legal_basis),
        courtOrAuthority: row.court_or_authority ? String(row.court_or_authority) : undefined,
        title: String(row.title),
        content: String(row.content),
        triggerKeywords: Array.isArray(row.trigger_keywords)
          ? (row.trigger_keywords as string[])
          : [],
        createdAt: String(row.created_at || new Date().toISOString()),
        updatedAt: String(row.updated_at || new Date().toISOString()),
      },
      bm25Score: Number(row.bm25_score ?? 0),
      vectorScore: Number(row.vector_score ?? 0),
      combinedScore: Number(row.combined_score ?? 0),
      matchSource: (row.match_source as HybridSearchResult['matchSource']) ?? 'HYBRID_FUSION',
    }));
  }
}

// Globales Singleton für Knowledge Repository
let globalKnowledgeRepo: IKnowledgeRepository | null = null;

export function getKnowledgeRepository(
  supabaseClient: SupabaseClient | null = null
): IKnowledgeRepository {
  if (!globalKnowledgeRepo) {
    globalKnowledgeRepo = new SupabaseKnowledgeRepository(supabaseClient);
  }
  return globalKnowledgeRepo;
}
