-- ============================================================================
-- Domain-Migration 01: Core Multi-Tenancy & Authorization
-- Consolidated Migration (gem. AGENTS.md Invariante 8)
-- Enthält: Notary Roles, Organizations, Organization Members, Profiles, Documents,
--          Audit Logs & Kernel-Level RLS gem. § 203 StGB & § 18 BNotO
-- ============================================================================

-- 1. Berufsrechtliche Rollen im deutschen Notariat
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notary_role') THEN
        CREATE TYPE notary_role AS ENUM (
            'NOTAR',            -- Hauptberuflicher Notar / Amtsinhaber (§ 3 Abs. 1 BNotO)
            'NOTARASSESSOR',    -- Notarassessor / Notarvertreter (§ 39 BNotO)
            'SACHBEARBEITER',   -- Notarfachangestellte(r) / Vorbereitung
            'ANWALTSNOTAR_RA',  -- Anwaltlicher Partner (§ 3 Abs. 2 BNotO, Kollisionsfilter)
            'ADMIN'             -- Kanzlei-Administrator (Technischer Support)
        );
    END IF;
END$$;

-- 2. Kanzlei-Tabelle (Organizations / Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    official_seat TEXT NOT NULL,
    chamber_district TEXT NOT NULL,
    tax_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default Organization anlegen, falls noch keine existiert (für Bestandsdaten-Migration)
INSERT INTO organizations (id, name, official_seat, chamber_district)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Notariat Standard Kanzlei',
    'Münster',
    'Westfälische Notarkammer'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Kanzlei-Mitgliedschaften & Rollenzuordnung
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role notary_role NOT NULL DEFAULT 'SACHBEARBEITER',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_lookup 
ON organization_members(user_id, organization_id);

-- 4. Profile-Tabelle (spiegelt auth.users im public-Schema wider)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automatischer Trigger bei Benutzerregistrierung (Supabase Auth -> Public Profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, title)
    VALUES (
        new.id,
        COALESCE(new.email, ''),  -- anonyme Demo-Sitzungen haben keine E-Mail
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        COALESCE(new.raw_user_meta_data->>'title', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Documents & Audit-Logs Tabellen
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    content JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
    document_id TEXT NOT NULL,
    -- Kettenfelder setzt ausschließlich der Trigger trg_audit_logs_chain; Clientwerte werden überschrieben.
    sequence_number BIGINT NOT NULL DEFAULT 0,
    action TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor TEXT NOT NULL,
    actor_id UUID,
    previous_hash VARCHAR NOT NULL DEFAULT '',
    current_hash VARCHAR NOT NULL DEFAULT '',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Hash-Kette je Akte: eine Sequenznummer darf nur einmal vergeben werden (verhindert Gabelungen)
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_logs_doc_seq ON audit_logs(document_id, sequence_number);

-- Hash eines Audit-Eintrags: SHA-256 über die kanonische jsonb-Darstellung (Schlüsselreihenfolge ist in
-- PostgreSQL deterministisch). Schreiben und Prüfen nutzen dieselbe Funktion.
CREATE OR REPLACE FUNCTION audit_record_hash(
    p_document_id TEXT, p_sequence BIGINT, p_action TEXT, p_timestamp TIMESTAMPTZ,
    p_actor TEXT, p_actor_id UUID, p_previous_hash TEXT, p_details JSONB
) RETURNS TEXT AS $$
    SELECT encode(sha256(convert_to(jsonb_build_object(
        'documentId', p_document_id,
        'sequenceNumber', p_sequence,
        'action', p_action,
        'timestamp', to_char(p_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'actor', p_actor,
        'actorId', p_actor_id,
        'previousHash', p_previous_hash,
        'details', p_details
    )::text, 'UTF8')), 'hex');
$$ LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp;

-- Verkettung serverseitig: Sequenz, Vorgänger-Hash, Zeitstempel, Akteur-ID und Hash kommen aus der Datenbank.
-- Der Advisory-Lock je Akte serialisiert parallele Einträge (keine Lücken, keine Gabelungen).
CREATE OR REPLACE FUNCTION audit_logs_chain() RETURNS TRIGGER AS $$
DECLARE
    v_sequence BIGINT;
    v_previous TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.document_id, 0));

    SELECT sequence_number + 1, current_hash INTO v_sequence, v_previous
    FROM audit_logs WHERE document_id = NEW.document_id
    ORDER BY sequence_number DESC LIMIT 1;

    IF NOT FOUND THEN
        v_sequence := 0;
        v_previous := repeat('0', 64);
    END IF;

    NEW.sequence_number := v_sequence;
    NEW.previous_hash := v_previous;
    NEW."timestamp" := now();
    NEW.actor_id := auth.uid();
    NEW.current_hash := audit_record_hash(
        NEW.document_id, NEW.sequence_number, NEW.action, NEW."timestamp",
        NEW.actor, NEW.actor_id, NEW.previous_hash, NEW.details
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_audit_logs_chain ON audit_logs;
CREATE TRIGGER trg_audit_logs_chain BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_chain();

-- Append-only: Ändern, Löschen und Leeren sind für alle Rollen gesperrt (auch für das Servicekonto).
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs ist append-only' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();

-- Prüft die Kette einer Akte (unter den Rechten des Aufrufers, also nur sichtbare Zeilen).
CREATE OR REPLACE FUNCTION verify_audit_chain(p_document_id TEXT) RETURNS JSONB AS $$
DECLARE
    r audit_logs;
    v_index BIGINT := 0;
    v_previous TEXT := repeat('0', 64);
BEGIN
    FOR r IN SELECT * FROM audit_logs WHERE document_id = p_document_id ORDER BY sequence_number LOOP
        IF r.sequence_number <> v_index THEN
            RETURN jsonb_build_object('valid', false, 'totalEntries', v_index, 'brokenSequenceIndex', v_index,
                'error', format('Invalide Sequenz: Erwartet %s, erhalten %s.', v_index, r.sequence_number));
        END IF;
        IF r.previous_hash <> v_previous THEN
            RETURN jsonb_build_object('valid', false, 'totalEntries', v_index, 'brokenSequenceIndex', v_index,
                'error', format('Kettenbruch bei Index %s: previousHash stimmt nicht überein.', v_index));
        END IF;
        IF r.current_hash <> audit_record_hash(r.document_id, r.sequence_number, r.action, r."timestamp",
                r.actor, r.actor_id, r.previous_hash, r.details) THEN
            RETURN jsonb_build_object('valid', false, 'totalEntries', v_index, 'brokenSequenceIndex', v_index,
                'error', format('Datenmanipulation bei Index %s festgestellt: Hash weicht vom Nutzdateninhalt ab.', v_index));
        END IF;
        v_previous := r.current_hash;
        v_index := v_index + 1;
    END LOOP;
    RETURN jsonb_build_object('valid', true, 'totalEntries', v_index);
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION verify_audit_chain(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verify_audit_chain(TEXT) TO authenticated;

-- 6. Helper-Funktionen zur Bestimmung von Mitgliedschaft und Rolle
CREATE OR REPLACE FUNCTION get_user_role(org_id UUID)
RETURNS notary_role AS $$
    SELECT role FROM organization_members
    WHERE user_id = auth.uid() AND organization_id = org_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid() AND organization_id = org_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Kontrollierter Onboarding-Pfad: Kanzlei und erste NOTAR-Mitgliedschaft entstehen atomar
-- für den angemeldeten Aufrufer. Direktes INSERT auf organizations ist per RLS nicht erlaubt.
CREATE OR REPLACE FUNCTION create_new_organization(
    org_name TEXT,
    org_seat TEXT,
    org_chamber TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_org organizations;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = '42501';
    END IF;
    INSERT INTO organizations (name, official_seat, chamber_district)
    VALUES (org_name, org_seat, org_chamber)
    RETURNING * INTO v_org;
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (v_org.id, v_user_id, 'NOTAR');
    RETURN to_jsonb(v_org);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION create_new_organization(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_new_organization(TEXT, TEXT, TEXT) TO authenticated;

-- 7. Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_chain ON audit_logs(organization_id, document_id, sequence_number ASC);

-- 8. Row-Level Security (RLS) aktivieren
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Organizations
DROP POLICY IF EXISTS rls_organizations_select ON organizations;
CREATE POLICY rls_organizations_select ON organizations FOR SELECT USING (is_org_member(id));

DROP POLICY IF EXISTS rls_organizations_insert ON public.organizations;
-- Kein INSERT-Policy: Kanzleien entstehen ausschließlich über create_new_organization().

DROP POLICY IF EXISTS rls_organizations_update ON public.organizations;
CREATE POLICY rls_organizations_update ON public.organizations FOR UPDATE TO authenticated USING (get_user_role(id) IN ('NOTAR', 'ADMIN')) WITH CHECK (get_user_role(id) IN ('NOTAR', 'ADMIN'));

-- Organization Members
DROP POLICY IF EXISTS rls_org_members_select ON public.organization_members;
CREATE POLICY rls_org_members_select ON public.organization_members FOR SELECT USING (is_org_member(organization_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS rls_org_members_insert ON public.organization_members;
CREATE POLICY rls_org_members_insert ON public.organization_members FOR INSERT TO authenticated WITH CHECK (get_user_role(organization_id) IN ('NOTAR', 'ADMIN'));

DROP POLICY IF EXISTS rls_org_members_update ON public.organization_members;
CREATE POLICY rls_org_members_update ON public.organization_members FOR UPDATE TO authenticated USING (get_user_role(organization_id) IN ('NOTAR', 'ADMIN')) WITH CHECK (get_user_role(organization_id) IN ('NOTAR', 'ADMIN'));

DROP POLICY IF EXISTS rls_org_members_delete ON public.organization_members;
CREATE POLICY rls_org_members_delete ON public.organization_members FOR DELETE USING (get_user_role(organization_id) IN ('NOTAR', 'ADMIN'));

-- Documents & Audit Logs (Veraltete Prototyp-Policies bereinigen)
DROP POLICY IF EXISTS "Allow all access to documents for prototype" ON documents;
DROP POLICY IF EXISTS "Allow select audit_logs" ON audit_logs;

DROP POLICY IF EXISTS rls_documents_all ON documents;
-- Lesen und Schreiben für alle Mitglieder; Löschen nur für Rollen mit DELETE_DOSSIER (Spiegel von src/lib/auth/rbac.ts,
-- abgesichert durch src/lib/auth/rbac-sql-parity.test.ts).
DROP POLICY IF EXISTS rls_documents_select ON documents;
CREATE POLICY rls_documents_select ON documents FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_documents_insert ON documents;
CREATE POLICY rls_documents_insert ON documents FOR INSERT WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_documents_update ON documents;
CREATE POLICY rls_documents_update ON documents FOR UPDATE USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_documents_delete ON documents;
CREATE POLICY rls_documents_delete ON documents FOR DELETE USING (get_user_role(organization_id) IN ('NOTAR', 'NOTARASSESSOR', 'ADMIN'));

DROP POLICY IF EXISTS rls_audit_logs_select ON audit_logs;
CREATE POLICY rls_audit_logs_select ON audit_logs FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_audit_logs_insert ON audit_logs;
CREATE POLICY rls_audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (is_org_member(organization_id));
