import { describe, it, expect, vi } from 'vitest';
import { KNOWLEDGE_CATEGORIES, KnowledgeDocument } from '@/types/knowledge';
import { SupabaseKnowledgeRepository } from './supabase-knowledge-repository';

describe('SupabaseKnowledgeRepository', () => {
  const doc: KnowledgeDocument = {
    id: '11111111-1111-4111-8111-111111111111',
    organizationId: null,
    category: KNOWLEDGE_CATEGORIES.DNOTI_GUTACHTEN,
    legalBasis: 'DNotI-Report 2023/15',
    title: 'MoPeG und eGbR bei Grundstücksveräußerungen',
    content:
      'Voreintragung der GbR im Gesellschaftsregister ist gem. § 47 Abs. 2 GBO i.V.m. Art. 229 § 21 EGBGB zwingend erforderlich.',
    triggerKeywords: ['gbr', 'mopeg', 'voreintragung'],
    createdAt: '2026-09-16T08:00:00.000Z',
    updatedAt: '2026-09-16T08:00:00.000Z',
  };

  it('fails fast and throws if Supabase client is missing', () => {
    expect(() => new SupabaseKnowledgeRepository(null as never)).toThrow(
      'SupabaseKnowledgeRepository erfordert einen gültigen SupabaseClient (Fail-Fast).'
    );
  });

  it('delegates to Supabase RPC match_knowledge_documents when client is present', async () => {
    const mockRpcData = [
      {
        id: doc.id,
        organization_id: null,
        category: doc.category,
        legal_basis: doc.legalBasis,
        court_or_authority: null,
        title: doc.title,
        content: doc.content,
        trigger_keywords: doc.triggerKeywords,
        bm25_score: 1.25,
        vector_score: 0.88,
        combined_score: 4.5,
        match_source: 'HYBRID_FUSION',
        created_at: doc.createdAt,
        updated_at: doc.updatedAt,
      },
    ];

    const mockRpc = vi.fn().mockResolvedValue({ data: mockRpcData, error: null });
    const mockSupabase = {
      rpc: mockRpc,
    };

    const repo = new SupabaseKnowledgeRepository(mockSupabase as never);
    const results = await repo.search({
      queryText: 'mopeg voreintragung',
      topK: 3,
      vectorWeight: 0.6,
    });

    expect(mockRpc).toHaveBeenCalledWith('match_knowledge_documents', {
      p_query_text: 'mopeg voreintragung',
      p_query_embedding: null,
      p_organization_id: null,
      p_category: null,
      p_match_count: 3,
      p_vector_weight: 0.6,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.document.id).toBe(doc.id);
    expect(results[0]?.combinedScore).toBe(4.5);
    expect(results[0]?.matchSource).toBe('HYBRID_FUSION');
  });

  it('fails fast and throws when Supabase upsert encounters a DB error', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'DB Connection Refused' } }),
          }),
        }),
      }),
    };

    const repo = new SupabaseKnowledgeRepository(mockSupabase as never);
    await expect(repo.save(doc)).rejects.toThrow(
      'Supabase knowledge save fehlgeschlagen: DB Connection Refused'
    );
  });

  it('fails fast and throws when Supabase RPC encounters a DB error', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'Postgres RPC Timeout' } }),
    };

    const repo = new SupabaseKnowledgeRepository(mockSupabase as never);
    await expect(repo.search({ queryText: 'gbr' })).rejects.toThrow(
      'Supabase knowledge search fehlgeschlagen: Postgres RPC Timeout'
    );
  });
});
