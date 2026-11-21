import { describe, it, expect, vi } from 'vitest';
import {
  EMBEDDING_DIMENSIONS,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_REVIEW_STATUS,
  KnowledgeDocument,
  MATCH_SOURCES,
} from '@/types/knowledge';
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
        text_score: 1.25,
        vector_score: 0.88,
        combined_score: 4.5,
        match_source: MATCH_SOURCES.HYBRID_FUSION,
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
      p_text_weight: 0.4,
      p_rrf_k: 60,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.document.id).toBe(doc.id);
    expect(results[0]?.combinedScore).toBe(4.5);
    expect(results[0]?.matchSource).toBe(MATCH_SOURCES.HYBRID_FUSION);
  });

  it('automatically calculates dynamic weights when weights are omitted', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSupabase = { rpc: mockRpc };
    const repo = new SupabaseKnowledgeRepository(mockSupabase as never);

    await repo.search({
      queryText: '§ 80 Abs. 2 GEG Energieausweis',
      topK: 5,
    });

    // Wegen §-Zeichen muss textWeight dynamisch 0.85 sein
    expect(mockRpc).toHaveBeenCalledWith('match_knowledge_documents', {
      p_query_text: '§ 80 Abs. 2 GEG Energieausweis',
      p_query_embedding: null,
      p_organization_id: null,
      p_category: null,
      p_match_count: 5,
      p_vector_weight: 0.15,
      p_text_weight: 0.85,
      p_rrf_k: 60,
    });
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

  it('delegates to Supabase query in getStatutoryRules and filters by organization', async () => {
    const mockData = [
      {
        id: doc.id,
        organization_id: null,
        category: KNOWLEDGE_CATEGORIES.GESETZLICHE_NORM,
        legal_basis: '§ 21 BeurkG',
        court_or_authority: null,
        title: 'Grundbuchstand',
        content: 'Grundbucheinsicht erforderlich.',
        trigger_keywords: ['grundbuch'],
        is_global: true,
        suggested_action: 'Einsicht nehmen',
        created_at: doc.createdAt,
        updated_at: doc.updatedAt,
      },
    ];

    const builder: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'neq', 'or']) builder[name] = vi.fn(() => builder);
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: mockData, error: null });
    const mockSupabase = { from: vi.fn().mockReturnValue(builder) };

    const repo = new SupabaseKnowledgeRepository(mockSupabase as never);
    const rules = await repo.getStatutoryRules('org-123');
    expect(rules).toHaveLength(1);
    expect(rules[0]?.title).toBe('Grundbuchstand');
    expect(rules[0]?.isGlobal).toBe(true);
  });

  it('übernimmt Prüfstatus, Gültigkeit, Version und Quelle aus dem Suchtreffer', async () => {
    const row = {
      id: doc.id,
      organization_id: null,
      category: doc.category,
      legal_basis: doc.legalBasis,
      title: doc.title,
      content: doc.content,
      trigger_keywords: [],
      source_reference: 'DNotI-Report 2023/15, S. 4',
      valid_from: '2024-01-01',
      valid_until: null,
      version: 3,
      review_status: KNOWLEDGE_REVIEW_STATUS.GEPRUEFT,
      text_score: 1,
      vector_score: 0,
      combined_score: 1,
      match_source: MATCH_SOURCES.TEXT_MATCH,
    };
    const repo = new SupabaseKnowledgeRepository({
      rpc: vi.fn().mockResolvedValue({ data: [row], error: null }),
    } as never);

    const [hit] = await repo.search({ queryText: 'gbr' });

    expect(hit?.document).toMatchObject({
      sourceReference: 'DNotI-Report 2023/15, S. 4',
      validFrom: '2024-01-01',
      version: 3,
      reviewStatus: KNOWLEDGE_REVIEW_STATUS.GEPRUEFT,
    });
  });

  it('filtert Gesetzesregeln auf gültige, nicht zurückgezogene Einträge', async () => {
    const calls: string[] = [];
    const builder: Record<string, unknown> = {};
    const chain = (name: string) =>
      vi.fn((...args: unknown[]) => {
        calls.push(`${name}:${args.join(',')}`);
        return builder;
      });
    for (const name of ['select', 'eq', 'neq', 'or']) builder[name] = chain(name);
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    const repo = new SupabaseKnowledgeRepository({ from: () => builder } as never);

    await repo.getStatutoryRules('a0000000-0000-4000-8000-000000000001');

    expect(calls).toContain('neq:review_status,ZURUECKGEZOGEN');
    expect(calls.filter((c) => c.startsWith('or:valid_'))).toHaveLength(2);
  });

  describe('Einbettungsmodell', () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5);

    it('übergibt Vektor und Modellkennung an die Suche', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const repo = new SupabaseKnowledgeRepository({ rpc: mockRpc } as never);

      await repo.search({ queryText: 'x', queryEmbedding: [0.1], embeddingModel: 'modell-a' });

      expect(mockRpc.mock.calls[0]?.[1]).toMatchObject({
        p_query_embedding: [0.1],
        p_embedding_model: 'modell-a',
      });
    });

    it('lässt die Modellkennung ohne Vektor weg (Suche gegen Datenbank vor der Migration)', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
      const repo = new SupabaseKnowledgeRepository({ rpc: mockRpc } as never);

      await repo.search({ queryText: 'x' });

      expect(mockRpc.mock.calls[0]?.[1]).not.toHaveProperty('p_embedding_model');
    });

    it('lehnt einen Anfragevektor ohne Modellkennung ab, statt still ohne Vektortreffer zu suchen', async () => {
      const mockRpc = vi.fn();
      const repo = new SupabaseKnowledgeRepository({ rpc: mockRpc } as never);

      await expect(repo.search({ queryText: 'x', queryEmbedding: [0.1] })).rejects.toThrow(
        /embeddingModel/
      );
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('schreibt beim Speichern eines Vektors die Modellkennung mit', async () => {
      const select = vi.fn().mockResolvedValue({ data: [{ id: 'd1' }], error: null });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      const repo = new SupabaseKnowledgeRepository({ from: () => ({ update }) } as never);

      await repo.saveEmbedding('d1', vector, 'modell-a');

      expect(update).toHaveBeenCalledWith({ embedding: vector, embedding_model: 'modell-a' });
    });

    it('zählt veraltete Vektoren: vorhanden, aber ohne oder mit anderer Modellkennung', async () => {
      const or = vi.fn().mockResolvedValue({ count: 4, error: null });
      const not = vi.fn().mockReturnValue({ or });
      const select = vi.fn().mockReturnValue({ not });
      const repo = new SupabaseKnowledgeRepository({ from: () => ({ select }) } as never);

      expect(await repo.countStaleEmbeddings('modell-a')).toBe(4);

      expect(not).toHaveBeenCalledWith('embedding', 'is', null);
      expect(or).toHaveBeenCalledWith('embedding_model.is.null,embedding_model.neq."modell-a"');
    });

    it('wirft, wenn das Zählen veralteter Vektoren fehlschlägt', async () => {
      const or = vi.fn().mockResolvedValue({ count: null, error: { message: 'kaputt' } });
      const repo = new SupabaseKnowledgeRepository({
        from: () => ({ select: () => ({ not: () => ({ or }) }) }),
      } as never);

      await expect(repo.countStaleEmbeddings('m')).rejects.toThrow(/kaputt/);
    });
  });
});
