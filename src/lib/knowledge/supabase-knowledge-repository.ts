import { SupabaseClient } from '@supabase/supabase-js';
import { IKnowledgeRepository } from '@/lib/knowledge/knowledge-repository';
import { DB_TABLES, Database, TableInsert } from '@/types/database';
import {
  HybridSearchQuery,
  HybridSearchResult,
  KNOWLEDGE_CATEGORIES,
  KnowledgeDocument,
} from '@/types/knowledge';

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
    const payload: TableInsert<typeof DB_TABLES.KNOWLEDGE_DOCUMENTS> = {
      id: doc.id,
      organization_id: doc.organizationId ?? null,
      category: doc.category,
      legal_basis: doc.legalBasis,
      court_or_authority: doc.courtOrAuthority ?? null,
      title: doc.title,
      content: doc.content,
      trigger_keywords: doc.triggerKeywords,
      embedding: doc.embedding ?? null,
    };

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
        isGlobal: Boolean(row.is_global ?? false),
        suggestedAction: row.suggested_action ? String(row.suggested_action) : undefined,
        createdAt: String(row.created_at || new Date().toISOString()),
        updatedAt: String(row.updated_at || new Date().toISOString()),
      },
      bm25Score: Number(row.bm25_score ?? 0),
      vectorScore: Number(row.vector_score ?? 0),
      combinedScore: Number(row.combined_score ?? 0),
      matchSource: (row.match_source as HybridSearchResult['matchSource']) ?? 'HYBRID_FUSION',
    }));
  }

  async getStatutoryRules(organizationId?: string | null): Promise<KnowledgeDocument[]> {
    let query = this.supabase
      .from(DB_TABLES.KNOWLEDGE_DOCUMENTS)
      .select('*')
      .eq('category', KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM);

    if (organizationId) {
      query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
    } else {
      query = query.is('organization_id', null);
    }

    const { data, error } = await query;
    if (error || !data) {
      throw new Error(
        `Supabase getStatutoryRules fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`
      );
    }

    const rows = data as Record<string, unknown>[];
    return rows.map((row) => ({
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
      isGlobal: Boolean(row.is_global ?? false),
      suggestedAction: row.suggested_action ? String(row.suggested_action) : undefined,
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
    }));
  }
}
