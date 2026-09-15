-- ============================================================================
-- Migration: 20260915120000_multi_tenancy_rls.sql
-- Ziel: Hermetische Mandantentrennung & Kanzlei-Isolation gem. § 203 StGB & § 18 BNotO
-- Enums, Organizations, Organization Members, RLS Policies & Performance-Indizes
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
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role notary_role NOT NULL DEFAULT 'SACHBEARBEITER',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_lookup 
ON organization_members(user_id, organization_id);

-- 4. Bestehende Tabellen für Kanzleitrennung anpassen

-- A. Documents (Dossiers)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE documents 
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

ALTER TABLE documents 
ALTER COLUMN organization_id SET NOT NULL;

-- B. Dossier Jobs (Queue)
CREATE TABLE IF NOT EXISTS dossier_jobs (
    id TEXT PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    stage TEXT,
    progress_details JSONB,
    payload JSONB NOT NULL,
    result_dossier_id TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C. Audit Logs (Revisionssicherer Audit-Trail § 17 ff. BeurkG)
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE audit_logs 
SET organization_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE organization_id IS NULL;

-- 5. Performance-Indizes für mandantenisolierte Abfragen
CREATE INDEX IF NOT EXISTS idx_documents_org 
ON documents(organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_org_queue 
ON dossier_jobs(organization_id, status, created_at)
WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_audit_logs_chain 
ON audit_logs(organization_id, document_id, sequence_number ASC);

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

-- 7. Row-Level Security (RLS) aktivieren
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dossier_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies definieren

-- Organizations: Nur Mitglieder dürfen Kanzlei-Stammdaten lesen
DROP POLICY IF EXISTS rls_organizations_select ON organizations;
CREATE POLICY rls_organizations_select ON organizations
    FOR SELECT
    USING (is_org_member(id));

-- Documents: Nur Mitglieder der eigenen Kanzlei haben Zugriff
DROP POLICY IF EXISTS rls_documents_all ON documents;
DROP POLICY IF EXISTS "Allow authenticated read/write on documents" ON documents;
CREATE POLICY rls_documents_all ON documents
    FOR ALL
    USING (is_org_member(organization_id))
    WITH CHECK (is_org_member(organization_id));

-- Dossier Jobs: Nur Kanzleimitglieder dürfen Jobs anlegen, ansehen und updaten
DROP POLICY IF EXISTS rls_jobs_all ON dossier_jobs;
CREATE POLICY rls_jobs_all ON dossier_jobs
    FOR ALL
    USING (is_org_member(organization_id))
    WITH CHECK (is_org_member(organization_id));

-- Audit Logs: Revisionssicher — alle Mitglieder dürfen lesen, Einfügen nur für Kanzleimitglieder
-- Kein UPDATE oder DELETE auf audit_logs erlaubt (Append-Only Integrität)
DROP POLICY IF EXISTS rls_audit_logs_select ON audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read/write on audit_logs" ON audit_logs;
CREATE POLICY rls_audit_logs_select ON audit_logs
    FOR SELECT
    USING (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_audit_logs_insert ON audit_logs;
CREATE POLICY rls_audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (is_org_member(organization_id));
