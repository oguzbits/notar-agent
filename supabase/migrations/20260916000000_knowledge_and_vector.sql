-- ============================================================================
-- Domain-Migration 02: Knowledge Store & Vector Hybrid Search
-- Consolidated Migration (gem. AGENTS.md Invariante 8)
-- Enthält: pgvector Extension, knowledge_documents Tabelle, GIN/Vektor-Indizes,
--          RPC match_knowledge_documents und den vollständigen juristischen Normenbestand (Seeds)
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
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category knowledge_category NOT NULL,
    legal_basis TEXT NOT NULL,
    court_or_authority TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
    embedding vector(1536),
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

DROP POLICY IF EXISTS p_select_knowledge_documents ON knowledge_documents;
CREATE POLICY p_select_knowledge_documents ON knowledge_documents
    FOR SELECT
    USING (
        organization_id IS NULL
        OR
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_insert_knowledge_documents ON knowledge_documents;
CREATE POLICY p_insert_knowledge_documents ON knowledge_documents
    FOR INSERT
    WITH CHECK (
        organization_id IS NOT NULL
        AND
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_update_knowledge_documents ON knowledge_documents;
CREATE POLICY p_update_knowledge_documents ON knowledge_documents
    FOR UPDATE
    USING (
        organization_id IS NOT NULL
        AND
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );

DROP POLICY IF EXISTS p_delete_knowledge_documents ON knowledge_documents;
CREATE POLICY p_delete_knowledge_documents ON knowledge_documents
    FOR DELETE
    USING (
        organization_id IS NOT NULL
        AND
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );

-- 6. Native Hybrid RPC-Funktion (Vektor-Kosinus-Ähnlichkeit + deutsches Volltext-Ranking)
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
            CASE 
                WHEN v_parsed_query IS NOT NULL THEN ts_rank_cd(kd.tsv, v_parsed_query)::FLOAT
                ELSE 0.0::FLOAT
            END AS raw_bm25,
            CASE 
                WHEN p_query_embedding IS NOT NULL AND kd.embedding IS NOT NULL THEN
                    GREATEST(0.0::FLOAT, (1.0::FLOAT - (kd.embedding <=> p_query_embedding)::FLOAT))
                ELSE 0.0::FLOAT
            END AS raw_vector,
            kd.created_at,
            kd.updated_at
        FROM knowledge_documents kd
        WHERE
            (kd.organization_id IS NULL OR kd.organization_id = p_organization_id)
            AND
            (p_category IS NULL OR kd.category = p_category)
            AND
            (
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

-- 7. Juristischer Normen- und Richtlinienbestand (Konsolidierte Seeds)
INSERT INTO knowledge_documents (
    id,
    organization_id,
    category,
    legal_basis,
    court_or_authority,
    title,
    content,
    trigger_keywords,
    created_at,
    updated_at
) VALUES
    -- 1. GEG 10 Jahre Energieausweis
    (
        'd0000000-0000-4000-8000-000000000001',
        NULL,
        'GESETZLICHE_NORM',
        '§ 80 Abs. 2 GEG',
        NULL,
        'Gültigkeit von Energieausweisen (10 Jahre)',
        'Energieausweise sind gem. § 80 Abs. 2 GEG genau 10 Jahre ab Ausstellungsdatum gültig. Liegt das Ablaufdatum vor dem Bearbeitungsstichtag, MUSS das Feld als OUTDATED (isExpired: true) markiert werden.',
        ARRAY['energieausweis', 'bedarfsausweis', 'verbrauchsausweis'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 2. § 21 BeurkG Grundbuchstand & Vollständigkeit
    (
        'd0000000-0000-4000-8000-000000000002',
        NULL,
        'GESETZLICHE_NORM',
        '§ 21 BeurkG',
        NULL,
        'Grundbuchstand, Vollständigkeit & Amtliche Einsicht',
        'Grundbuchauszüge verfallen nicht kalendarisch und belegen den Aktenstand grundsätzlich (VERIFIED), WENN der Auszug vollständig vorliegt. Liegt jedoch erkennbar nur ein unvollständiger Teilauszug vor (z. B. "Seite 1 von 3", fehlende Abteilung I/II oder Vermerk über nicht übernommene Eintragungen), MUSS das Feld grundbuch zwingend auf NEEDS_REVIEW gesetzt werden, da die Beurkundungsreife ohne vollständige Einsicht in Abteilung I (Eigentümer) und II (Lasten) gem. § 21 BeurkG nicht gegeben ist. Ein vollständiger Grundbuchauszug ist nachzufordern.',
        ARRAY['grundbuch', 'grundbuchauszug', 'blatt', 'teilauszug'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 3. MoPeG / eGbR
    (
        'd0000000-0000-4000-8000-000000000003',
        NULL,
        'GESETZLICHE_NORM',
        '§ 707 BGB, § 47 Abs. 2 GBO n.F. (MoPeG)',
        NULL,
        'eGbR-Voreintragungspflicht bei Immobiliengeschäften',
        'Seit Inkrafttreten des MoPeG muss eine rechtsfähige GbR im neuen Gesellschaftsregister (eGbR) eingetragen sein, um im Grundbuch als Eigentümerin eingetragen zu werden oder über ein Grundstück zu verfügen (§ 47 Abs. 2 GBO). Fehlt der Registerauszug (GsR) oder der Namenszusatz "eGbR", ist das Feld auf NEEDS_REVIEW zu setzen und ein Nachweis der Eintragung nachzufordern.',
        ARRAY['gbr', 'gesellschaft bürgerlichen rechts', 'egbr'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 4. § 12 HGB Vertretungsnachweis
    (
        'd0000000-0000-4000-8000-000000000004',
        NULL,
        'GESETZLICHE_NORM',
        '§ 12 HGB, § 21 BNotO',
        NULL,
        'Vertretungsnachweis juristischer Personen',
        'Bei eingetragenen Handelsgesellschaften (GmbH, UG, AG, KG, OHG) muss ein amtlicher Handelsregisterauszug vorliegen und die Vertretungsbefugnis (Einzel- vs. Gesamtvertretung) feststehen. Fehlt der Registerauszug, ist das Feld auf NEEDS_REVIEW zu setzen und eine gezielte Nachforderung (inquiry) zu stellen.',
        ARRAY['gmbh', 'ug', 'kg', 'ag', 'ohg', 'gmbh & co'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 5. MaBV Ratenstaffel
    (
        'd0000000-0000-4000-8000-000000000005',
        NULL,
        'GESETZLICHE_NORM',
        '§ 3 MaBV, § 650u BGB',
        NULL,
        'MaBV-Ratenstaffel bei Bauträgerverträgen',
        'Werden Raten nach Baufortschritt vereinbart, müssen die Fälligkeitsstufen zwingend den gesetzlichen Prozentsätzen des § 3 MaBV entsprechen. Weicht die Ratenstaffel ab oder fehlen Baufortschritts-Nachweise, ist das Feld kaufpreis auf NEEDS_REVIEW zu setzen.',
        ARRAY['bauträger', 'baufortschritt', 'mabv', 'raten', 'teilzahlungen'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 6. § 566 BGB Kauf bricht nicht Miete
    (
        'd0000000-0000-4000-8000-000000000006',
        NULL,
        'GESETZLICHE_NORM',
        '§ 566, § 566a BGB',
        NULL,
        'Kauf bricht nicht Miete & Kautionsübergang',
        'Der Erwerber tritt gem. § 566 BGB kraft Gesetzes in bestehende Mietverträge ein. Liegen nur geschwärzte Mietlisten oder keine Belege über Kautionskonten (§ 566a BGB) vor, ist das Feld mietverhaeltnisse auf NEEDS_REVIEW zu setzen.',
        ARRAY['miete', 'mietvertrag', 'vermietet', 'kaution', 'mietverhaeltnisse'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 7. DNotI-Report MoPeG
    (
        'd0000001-0000-4000-8000-000000000001',
        NULL,
        'DNOTI_GUTACHTEN',
        'DNotI-Report 2023/18 (MoPeG)',
        'Deutsches Notarinstitut (DNotI)',
        'Voreintragung der eGbR im Gesellschaftsregister (§ 47 Abs. 2 GBO n.F.)',
        'Seit dem 01.01.2024 (MoPeG) kann eine Gesellschaft bürgerlichen Rechts (GbR) über ein im Grundbuch eingetragenes Recht nur verfügen oder ein Recht erwerben, wenn sie zuvor im Gesellschaftsregister eingetragen und sodann im Grundbuch als "eGbR" berichtigt ist.',
        ARRAY['gbr', 'mopeg', 'voreintragung', 'gesellschaftsregister', 'egbr'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 8. AG Hamburg Handelsregisterauszug
    (
        'd0000001-0000-4000-8000-000000000002',
        NULL,
        'AMTSGERICHT_PRAXIS',
        '§ 12 HGB / AG Hamburg Az. 14 HRB',
        'Amtsgericht Hamburg (Registergericht)',
        'Aktualität von Handelsregisterauszügen bei Vertretungshandlungen',
        'Wird bei der Veräußerung oder Belastung einer Liegenschaft eine juristische Person (GmbH, UG, AG, KG) vertreten, verlangt das Registergericht sowie das Grundbuchamt Hamburg zwingend den Nachweis der Vertretungsmacht durch einen tagesaktuellen (maximal 14 Tage alten) beglaubigten Registerauszug.',
        ARRAY['gmbh', 'ug', 'kg', 'ag', 'hamburg', 'registerauszug', 'vertretungsmacht'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 9. DNotI Sanierungsvermerk
    (
        'd0000001-0000-4000-8000-000000000003',
        NULL,
        'DNOTI_GUTACHTEN',
        'DNotI-Gutachten Dok.-Nr. 184592 (§ 144 BauGB)',
        'Deutsches Notarinstitut (DNotI)',
        'Genehmigungspflicht bei Sanierungs- und Entwicklungsvermerken',
        'Befindet sich das Flurstück in einem förmlich festgelegten Sanierungsgebiet (§ 142 BauGB), bedarf der Kaufvertrag sowie die Auflassung der schriftlichen Genehmigung der Gemeinde gem. § 144 Abs. 2 BauGB vor Vollzug.',
        ARRAY['sanierungsvermerk', 'entwicklungsvermerk', 'baugb', 'gemeindegenehmigung'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 10. OLG München Erbnachweis
    (
        'd0000001-0000-4000-8000-000000000004',
        NULL,
        'AMTSGERICHT_PRAXIS',
        '§ 35 GBO / OLG München 34 Wx',
        'OLG München / AG München (Grundbuchamt)',
        'Erbnachweis bei unberichtigtem Grundbuch',
        'Ist im Grundbuch noch der Erblasser eingetragen, kann der Nachweis der Erbfolge gegenüber dem Grundbuchamt nur durch Erbschein oder europäisches Nachlasszeugnis bzw. notarielles Testament mit Eröffnungsprotokoll geführt werden (§ 35 Abs. 1 GBO).',
        ARRAY['erblasser', 'erbschein', 'erbfall', 'testament', 'nachlass'],
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z'
    ),
    -- 11. § 13, § 44a BeurkG Handschriftliche Randkorrekturen & Streichungen
    (
        'd0000000-0000-4000-8000-000000000011',
        NULL,
        'GESETZLICHE_NORM',
        '§ 13 BeurkG, § 44a BeurkG',
        'Bundesnotarordnung / Beurkundungsgesetz',
        'Handschriftliche Randkorrekturen, Streichungen & Vorbehalte bei Urkunden',
        'Weist eine vorgelegte Urkunde oder ein Vertragsentwurf handschriftliche Streichungen, Einfügungen oder Randkorrekturen auf (z.B. geänderter Kaufpreis), MUSS das betroffene Feld auf NEEDS_REVIEW gesetzt werden. Im Notariat muss vor der Beurkundung zweifelsfrei geklärt werden, ob die Streichung von allen Urkundsbeteiligten paraphiert und genehmigt wurde.',
        ARRAY['kaufpreis', 'gestrichen', 'durchgestrichen', 'handschriftlich', 'randkorrektur', 'nachtrag', 'paraphe'],
        '2026-09-24T20:00:00.000Z',
        '2026-09-24T20:00:00.000Z'
    )
ON CONFLICT (id) DO UPDATE SET
    category = EXCLUDED.category,
    legal_basis = EXCLUDED.legal_basis,
    court_or_authority = EXCLUDED.court_or_authority,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    trigger_keywords = EXCLUDED.trigger_keywords,
    updated_at = now();
