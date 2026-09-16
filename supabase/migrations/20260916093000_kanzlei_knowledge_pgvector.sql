-- ============================================================================
-- Migration: 20260916093000_kanzlei_knowledge_pgvector.sql
-- Ziel: C.3 Erweitertes Kanzlei- & DNotI-RAG (pgvector + BM25 Full-Text Search)
-- Unterstützt: DNotI-Gutachten, Amtsgerichts-Praxis, Kanzlei-Richtlinien
-- RLS-Isolation gem. § 203 StGB & § 18 BNotO
-- ============================================================================

-- 1. pgvector Extension aktivieren
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Enum für Wissens-Kategorien
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_category') THEN
        CREATE TYPE knowledge_category AS ENUM (
            'GESETZLICHE_NORM',
            'DNOTI_GUTACHTEN',
            'AMTSGERICHT_PRAXIS',
            'KANZLEI_RICHTLINIE'
        );
    END IF;
END$$;

-- 3. Kanzlei- & DNotI-Wissenstabelle
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- organization_id IS NULL bedeutet: Kanzleiübergreifende Allgemeingültigkeit (DNotI, BGH, Gesetzesnorm)
    -- organization_id IS NOT NULL bedeutet: Private interne Kanzleirichtlinie (§ 203 StGB geschützt)
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category knowledge_category NOT NULL,
    legal_basis TEXT NOT NULL,
    court_or_authority TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
    -- 1536-dimensionales Embedding (Standard für OpenAI/Gemini Embeddings)
    embedding vector(1536),
    -- Full-Text-Search Spalte (Deutsch) für BM25 / GIN Indexierung
    tsv tsvector,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger-Funktion zur Aktualisierung des tsvectors (deterministisch & immutable-sicher)
CREATE OR REPLACE FUNCTION update_knowledge_documents_tsv()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tsv := to_tsvector('german', coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, '') || ' ' || coalesce(NEW.legal_basis, '') || ' ' || array_to_string(NEW.trigger_keywords, ' '));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_documents_tsv ON knowledge_documents;
CREATE TRIGGER trg_knowledge_documents_tsv
    BEFORE INSERT OR UPDATE OF title, content, legal_basis, trigger_keywords
    ON knowledge_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_documents_tsv();


-- 4. Indizes für Hochleistungs-Hybrid-Search
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tsv ON knowledge_documents USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_category ON knowledge_documents (category);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org ON knowledge_documents (organization_id);

-- 5. Row-Level Security (RLS) aktivieren
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies:
-- Benutzer dürfen Dokumente sehen, wenn:
-- a) organization_id NULL ist (öffentliches juristisches DNotI-/Normen-Wissen)
-- ODER
-- b) organization_id mit der aktiven Tenant-Organisation des Nutzers übereinstimmt.
CREATE POLICY p_select_knowledge_documents ON knowledge_documents
    FOR SELECT
    USING (
        organization_id IS NULL
        OR
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );

CREATE POLICY p_insert_knowledge_documents ON knowledge_documents
    FOR INSERT
    WITH CHECK (
        organization_id IS NOT NULL
        AND
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );

CREATE POLICY p_update_knowledge_documents ON knowledge_documents
    FOR UPDATE
    USING (
        organization_id IS NOT NULL
        AND
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );

CREATE POLICY p_delete_knowledge_documents ON knowledge_documents
    FOR DELETE
    USING (
        organization_id IS NOT NULL
        AND
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );

-- 7. Native Hybrid RPC-Funktion (Vektor-Kosinus-Ähnlichkeit + deutsches Volltext-Ranking)
-- Berechnet die Ähnlichkeit direkt im PostgreSQL-Kernel ohne Netzwerk-Overhead
CREATE OR REPLACE FUNCTION match_knowledge_documents(
    p_query_text TEXT,
    p_query_embedding vector(1536) DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_category knowledge_category DEFAULT NULL,
    p_match_count INT DEFAULT 5,
    p_vector_weight FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    organization_id UUID,
    category knowledge_category,
    legal_basis TEXT,
    court_or_authority TEXT,
    title TEXT,
    content TEXT,
    trigger_keywords TEXT[],
    bm25_score FLOAT,
    vector_score FLOAT,
    combined_score FLOAT,
    match_source TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_parsed_query tsquery;
BEGIN
    -- Sichere Volltext-Query auf Deutsch erzeugen
    IF p_query_text IS NOT NULL AND trim(p_query_text) <> '' THEN
        v_parsed_query := plainto_tsquery('german', p_query_text);
    ELSE
        v_parsed_query := NULL;
    END IF;

    RETURN QUERY
    WITH ranked_docs AS (
        SELECT
            kd.id,
            kd.organization_id,
            kd.category,
            kd.legal_basis,
            kd.court_or_authority,
            kd.title,
            kd.content,
            kd.trigger_keywords,
            -- BM25 / Full-Text Score
            CASE 
                WHEN v_parsed_query IS NOT NULL THEN ts_rank_cd(kd.tsv, v_parsed_query)::FLOAT
                ELSE 0.0::FLOAT
            END AS raw_bm25,
            -- Vector Similarity Score (1 - Cosine Distance)
            CASE 
                WHEN p_query_embedding IS NOT NULL AND kd.embedding IS NOT NULL THEN
                    GREATEST(0.0::FLOAT, (1.0::FLOAT - (kd.embedding <=> p_query_embedding)::FLOAT))
                ELSE 0.0::FLOAT
            END AS raw_vector,
            kd.created_at,
            kd.updated_at
        FROM knowledge_documents kd
        WHERE
            -- Kanzlei-Isolation (§ 203 StGB): Nur globale oder eigene Kanzleidokumente
            (kd.organization_id IS NULL OR kd.organization_id = p_organization_id)
            AND
            -- Optionale Kategorie-Filterung
            (p_category IS NULL OR kd.category = p_category)
            AND
            (
                -- Mindestens ein Kriterium muss greifen
                (v_parsed_query IS NOT NULL AND kd.tsv @@ v_parsed_query)
                OR
                (p_query_embedding IS NOT NULL AND kd.embedding IS NOT NULL)
            )
    )
    SELECT
        rd.id,
        rd.organization_id,
        rd.category,
        rd.legal_basis,
        rd.court_or_authority,
        rd.title,
        rd.content,
        rd.trigger_keywords,
        rd.raw_bm25 AS bm25_score,
        rd.raw_vector AS vector_score,
        -- Kombinierter Score (Gewichtete Fusion)
        ROUND(
            (((1.0 - p_vector_weight) * rd.raw_bm25 * 5.0) + (p_vector_weight * rd.raw_vector * 5.0))::NUMERIC,
            2
        )::FLOAT AS combined_score,
        CASE
            WHEN rd.raw_bm25 > 0 AND rd.raw_vector > 0 THEN 'HYBRID_FUSION'
            WHEN rd.raw_vector > 0 THEN 'SEMANTIC_VECTOR'
            ELSE 'BM25_EXACT'
        END AS match_source,
        rd.created_at,
        rd.updated_at
    FROM ranked_docs rd
    ORDER BY combined_score DESC
    LIMIT p_match_count;
END;
$$;

