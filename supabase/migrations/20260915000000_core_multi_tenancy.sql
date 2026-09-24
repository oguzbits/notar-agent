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
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        COALESCE(new.raw_user_meta_data->>'title', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB,
    hash TEXT,
    previous_hash TEXT,
    sequence_number BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Helper-Funktionen zur Bestimmung von Mitgliedschaft und Rolle
CREATE OR REPLACE FUNCTION get_user_role(org_id UUID)
RETURNS notary_role AS $$
    SELECT role FROM organization_members
    WHERE user_id = auth.uid() AND organization_id = org_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid() AND organization_id = org_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

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

-- Organizations
DROP POLICY IF EXISTS rls_organizations_select ON organizations;
CREATE POLICY rls_organizations_select ON organizations FOR SELECT USING (is_org_member(id));

DROP POLICY IF EXISTS rls_organizations_insert ON public.organizations;
CREATE POLICY rls_organizations_insert ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS rls_organizations_update ON public.organizations;
CREATE POLICY rls_organizations_update ON public.organizations FOR UPDATE TO authenticated USING (get_user_role(id) IN ('NOTAR', 'ADMIN')) WITH CHECK (get_user_role(id) IN ('NOTAR', 'ADMIN'));

-- Organization Members
DROP POLICY IF EXISTS rls_org_members_select ON public.organization_members;
CREATE POLICY rls_org_members_select ON public.organization_members FOR SELECT USING (is_org_member(organization_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS rls_org_members_insert ON public.organization_members;
CREATE POLICY rls_org_members_insert ON public.organization_members FOR INSERT WITH CHECK (get_user_role(organization_id) IN ('NOTAR', 'ADMIN') OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = organization_members.organization_id));

DROP POLICY IF EXISTS rls_org_members_update ON public.organization_members;
CREATE POLICY rls_org_members_update ON public.organization_members FOR UPDATE USING (get_user_role(organization_id) IN ('NOTAR', 'ADMIN'));

DROP POLICY IF EXISTS rls_org_members_delete ON public.organization_members;
CREATE POLICY rls_org_members_delete ON public.organization_members FOR DELETE USING (get_user_role(organization_id) IN ('NOTAR', 'ADMIN'));

-- Documents & Audit Logs
DROP POLICY IF EXISTS rls_documents_all ON documents;
CREATE POLICY rls_documents_all ON documents FOR ALL USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_audit_logs_select ON audit_logs;
CREATE POLICY rls_audit_logs_select ON audit_logs FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_audit_logs_insert ON audit_logs;
CREATE POLICY rls_audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (is_org_member(organization_id));
