import { SupabaseClient } from '@supabase/supabase-js';
import { IKnowledgeRepository } from '@/lib/knowledge/knowledge-repository';
import { DB_TABLES, Database } from '@/types/database';
import {
  HybridSearchQuery,
  HybridSearchResult,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_REVIEW_STATUS,
  KnowledgeDocument,
  MATCH_SOURCES,
} from '@/types/knowledge';

import { calculateDynamicWeights } from './dynamic-weights';
import { documentToRow, rowToDocument } from './knowledge-row-mapper';

export type { IKnowledgeRepository };

/**
 * Supabase Knowledge Repository (Phase C.3).
 * Führt die Hybrid-Suche deterministisch auf PostgreSQL via pgvector RPC 'match_knowledge_documents' aus.
 * Fail-Fast: Wirft sofort bei fehlendem Client oder DB-Fehlern (§ 203 StGB & Database-First Invariant).
 */
export class SupabaseKnowledgeRepository implements IKnowledgeRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseClient: SupabaseClient<Database>) {
    if (!supabaseClient) {
      throw new Error(
        'SupabaseKnowledgeRepository erfordert einen gültigen SupabaseClient (Fail-Fast).'
      );
    }
    this.supabase = supabaseClient;
  }

  async save(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    const payload = documentToRow(doc);

    const { data, error } = await this.supabase
      .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
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
    // Dynamische Gewichtung zwischen Volltext & Vektor ermitteln
    const dynamic = calculateDynamicWeights(query.queryText);
    const textWeight =
      query.textWeight ??
      (query.vectorWeight !== undefined ? 1.0 - query.vectorWeight : dynamic.textWeight);
    const vectorWeight = query.vectorWeight ?? dynamic.vectorWeight;
    const rrfK = query.rrfK ?? 60;

    const { data, error } = await this.supabase.rpc('match_knowledge_documents', {
      p_query_text: query.queryText,
      p_query_embedding: query.queryEmbedding ?? null,
      p_organization_id: query.organizationId ?? null,
      p_category: query.category ?? null,
      p_match_count: query.topK ?? 5,
      p_vector_weight: vectorWeight,
      p_text_weight: textWeight,
      p_rrf_k: rrfK,
    });

    if (error || !data) {
      throw new Error(
        `Supabase knowledge search fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    const rows = data as Record<string, unknown>[];

    return rows.map((row) => ({
      document: rowToDocument(row),
      textScore: Number(row.text_score ?? 0),
      vectorScore: Number(row.vector_score ?? 0),
      combinedScore: Number(row.combined_score ?? 0),
      matchSource:
        (row.match_source as HybridSearchResult['matchSource']) ?? MATCH_SOURCES.HYBRID_FUSION,
      textRank: row.text_rank ? Number(row.text_rank) : null,
      vectorRank: row.vector_rank ? Number(row.vector_rank) : null,
      rrfScore: Number(row.combined_score ?? 0),
    }));
  }

  async getStatutoryRules(organizationId?: string | null): Promise<KnowledgeDocument[]> {
    const filter = organizationId
      ? `organization_id.is.null,organization_id.eq.${organizationId}`
      : 'organization_id.is.null';

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await this.supabase
      .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
      .select('*')
      .eq('category', KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM)
      .neq('review_status', KNOWLEDGE_REVIEW_STATUS.ZURUECKGEZOGEN)
      .or(filter)
      .or(`valid_from.is.null,valid_from.lte.${today}`)
      .or(`valid_until.is.null,valid_until.gte.${today}`);
    if (error || !data) {
      throw new Error(
        `Supabase getStatutoryRules fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    const rows = data as Record<string, unknown>[];
    return rows.map((row) => rowToDocument(row));
  }
}
