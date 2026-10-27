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

-- 2b. Prüfstatus der Wissenseinträge (Governance)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'knowledge_review_status') THEN
        CREATE TYPE knowledge_review_status AS ENUM ('UNGEPRUEFT', 'GEPRUEFT', 'ZURUECKGEZOGEN');
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
    source_reference TEXT,
    valid_from DATE,
    valid_until DATE,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    review_status knowledge_review_status NOT NULL DEFAULT 'UNGEPRUEFT',
    -- Aufbewahrungsfrist in Jahren (nur für Fristeinträge); NULL = kein Fristeintrag
    retention_years INT CHECK (retention_years IS NULL OR retention_years > 0),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_knowledge_validity_order CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
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
        is_org_member(organization_id)
    );

DROP POLICY IF EXISTS p_insert_knowledge_documents ON knowledge_documents;
CREATE POLICY p_insert_knowledge_documents ON knowledge_documents
    FOR INSERT
    WITH CHECK (
        organization_id IS NOT NULL
        AND
        get_user_role(organization_id) IN ('NOTAR', 'ADMIN')
    );

DROP POLICY IF EXISTS p_update_knowledge_documents ON knowledge_documents;
CREATE POLICY p_update_knowledge_documents ON knowledge_documents
    FOR UPDATE
    USING (
        organization_id IS NOT NULL
        AND
        get_user_role(organization_id) IN ('NOTAR', 'ADMIN')
    );

DROP POLICY IF EXISTS p_delete_knowledge_documents ON knowledge_documents;
CREATE POLICY p_delete_knowledge_documents ON knowledge_documents
    FOR DELETE
    USING (
        organization_id IS NOT NULL
        AND
        get_user_role(organization_id) IN ('NOTAR', 'ADMIN')
    );

-- 6. Native Hybrid RPC-Funktion mit Reciprocal Rank Fusion (RRF gem. Cormack et al. / notebooklm-klon)
CREATE OR REPLACE FUNCTION match_knowledge_documents(
    p_query_text TEXT,
    p_query_embedding vector(1536) DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_category knowledge_category DEFAULT NULL,
    p_match_count INT DEFAULT 5,
    p_vector_weight FLOAT DEFAULT 0.5,
    p_text_weight FLOAT DEFAULT 0.5,
    p_rrf_k INT DEFAULT 60
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
    source_reference TEXT,
    valid_from DATE,
    valid_until DATE,
    version INT,
    review_status knowledge_review_status,
    text_score FLOAT,
    vector_score FLOAT,
    combined_score FLOAT,
    match_source TEXT,
    text_rank INT,
    vector_rank INT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_parsed_query tsquery;
BEGIN
    IF p_query_text IS NOT NULL AND trim(p_query_text) <> '' THEN
        -- ODER-Verknüpfung: Lange Anfragen (Vorgangstyp, Notizen, Dateinamen) dürfen Treffer liefern,
        -- auch wenn nicht jedes Wort vorkommt; die Rangfolge übernimmt ts_rank_cd.
        v_parsed_query := NULLIF(
            replace(plainto_tsquery('german', p_query_text)::text, ' & ', ' | '),
            ''
        )::tsquery;
    ELSE
        v_parsed_query := NULL;
    END IF;

    RETURN QUERY
    WITH
    vector_ranked AS (
        SELECT
            kd.id,
            row_number() OVER (ORDER BY (kd.embedding <=> p_query_embedding), kd.id)::INT AS rank,
            GREATEST(0.0::FLOAT, (1.0::FLOAT - (kd.embedding <=> p_query_embedding)::FLOAT)) AS raw_vector
        FROM knowledge_documents kd
        WHERE
            (kd.organization_id IS NULL OR kd.organization_id = p_organization_id)
            AND
            (p_category IS NULL OR kd.category = p_category)
            AND
            p_query_embedding IS NOT NULL
            AND
            kd.embedding IS NOT NULL
            AND
            kd.review_status <> 'ZURUECKGEZOGEN'
            AND
            (kd.valid_from IS NULL OR kd.valid_from <= current_date)
            AND
            (kd.valid_until IS NULL OR kd.valid_until >= current_date)
        ORDER BY (kd.embedding <=> p_query_embedding), kd.id
        LIMIT 20
    ),
    text_ranked AS (
        SELECT
            kd.id,
            row_number() OVER (ORDER BY ts_rank_cd(kd.tsv, v_parsed_query) DESC, kd.id)::INT AS rank,
            ts_rank_cd(kd.tsv, v_parsed_query)::FLOAT AS raw_text
        FROM knowledge_documents kd
        WHERE
            (kd.organization_id IS NULL OR kd.organization_id = p_organization_id)
            AND
            (p_category IS NULL OR kd.category = p_category)
            AND
            v_parsed_query IS NOT NULL
            AND
            kd.tsv @@ v_parsed_query
            AND
            kd.review_status <> 'ZURUECKGEZOGEN'
            AND
            (kd.valid_from IS NULL OR kd.valid_from <= current_date)
            AND
            (kd.valid_until IS NULL OR kd.valid_until >= current_date)
        ORDER BY ts_rank_cd(kd.tsv, v_parsed_query) DESC, kd.id
        LIMIT 20
    ),
    fused AS (
        SELECT
            c.id,
            sum(c.part)::FLOAT AS rrf_score,
            max(c.raw_text) AS text_score,
            max(c.raw_vector) AS vector_score,
            min(c.text_rank) AS text_rank,
            min(c.vector_rank) AS vector_rank
        FROM (
            SELECT
                vr.id,
                (p_vector_weight::NUMERIC / (p_rrf_k + vr.rank))::FLOAT AS part,
                0.0::FLOAT AS raw_text,
                vr.raw_vector,
                NULL::INT AS text_rank,
                vr.rank AS vector_rank
            FROM vector_ranked vr
            UNION ALL
            SELECT
                tr.id,
                (p_text_weight::NUMERIC / (p_rrf_k + tr.rank))::FLOAT AS part,
                tr.raw_text,
                0.0::FLOAT AS raw_vector,
                tr.rank AS text_rank,
                NULL::INT AS vector_rank
            FROM text_ranked tr
        ) c
        GROUP BY c.id
    )
    SELECT
        kd.id,
        kd.organization_id,
        kd.category,
        kd.legal_basis,
        kd.court_or_authority,
        kd.title,
        kd.content,
        kd.trigger_keywords,
        kd.source_reference,
        kd.valid_from,
        kd.valid_until,
        kd.version,
        kd.review_status,
        f.text_score,
        f.vector_score,
        f.rrf_score AS combined_score,
        CASE
            WHEN f.text_rank IS NOT NULL AND f.vector_rank IS NOT NULL THEN 'HYBRID_FUSION'
            WHEN f.vector_rank IS NOT NULL THEN 'SEMANTIC_VECTOR'
            ELSE 'TEXT_MATCH'
        END AS match_source,
        f.text_rank,
        f.vector_rank,
        kd.created_at,
        kd.updated_at
    FROM fused f
    JOIN knowledge_documents kd ON kd.id = f.id
    ORDER BY f.rrf_score DESC, kd.id
    LIMIT p_match_count;
END;
$$;


REVOKE EXECUTE ON FUNCTION match_knowledge_documents(TEXT, vector, UUID, knowledge_category, INT, FLOAT, FLOAT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION match_knowledge_documents(TEXT, vector, UUID, knowledge_category, INT, FLOAT, FLOAT, INT) TO authenticated;

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
        'Grundbuchdaten aus vollständigen amtlichen Grundbuchauszügen sowie Grundbuchbezeichnungen aus notariellen Urkunden und Verträgen belegen die Bestandsdaten grundsätzlich als VERIFIED. Liegt jedoch ein amtlicher Grundbuchauszug selbst als unvollständiger Teilauszug vor (z. B. ausgewiesen als "Seite 1 von 3", fehlende Abteilung I/II oder Vermerk über nicht übernommene Eintragungen), MUSS das Feld grundbuch auf NEEDS_REVIEW gesetzt werden. Liegt eine notarielle Urkunde oder ein vollständiger Vertrag vor, der den Grundbesitz bezeichnet, ist das Feld grundbuch VERIFIED, sofern kein abweichender Teilauszug vorliegt.',
        ARRAY['grundbuch', 'grundbuchauszug', 'teilauszug', 'blatt'],
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
    ),
    -- 12. § 5, § 7 GmbHG Mindeststammkapital & Mindesteinzahlung
    (
        'd0000000-0000-4000-8000-000000000012',
        NULL,
        'GESETZLICHE_NORM',
        '§ 5 Abs. 1 GmbHG, § 7 Abs. 2 und 3 GmbHG',
        NULL,
        'Mindeststammkapital und Mindesteinzahlung bei der GmbH-Gründung',
        'Das Stammkapital der GmbH muss mindestens 25.000 Euro betragen (§ 5 Abs. 1 GmbHG); der Nennbetrag jedes Geschäftsanteils muss auf volle Euro lauten (§ 5 Abs. 2 GmbHG). Die Anmeldung zum Handelsregister ist erst zulässig, wenn auf jeden Geschäftsanteil mindestens ein Viertel des Nennbetrags eingezahlt ist und die Geldeinlagen zuzüglich des Nennbetrags der Anteile mit Sacheinlagen insgesamt mindestens die Hälfte des Mindeststammkapitals erreichen (§ 7 Abs. 2 GmbHG). Sacheinlagen müssen vor der Anmeldung so erbracht sein, dass sie endgültig zur freien Verfügung der Geschäftsführer stehen (§ 7 Abs. 3 GmbHG). Weicht das Stammkapital oder die Einzahlung im Gründungsdokument von diesen Vorgaben ab, MUSS das betroffene Feld auf NEEDS_REVIEW gesetzt werden.',
        ARRAY['stammkapital', 'gmbh', 'gründung', 'geschäftsanteil', 'stammeinlage', 'einzahlung', 'sacheinlage'],
        '2026-10-28T00:00:00.000Z',
        '2026-10-28T00:00:00.000Z'
    )
ON CONFLICT (id) DO UPDATE SET
    category = EXCLUDED.category,
    legal_basis = EXCLUDED.legal_basis,
    court_or_authority = EXCLUDED.court_or_authority,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    trigger_keywords = EXCLUDED.trigger_keywords,
    updated_at = now();
