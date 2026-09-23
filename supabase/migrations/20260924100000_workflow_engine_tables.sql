-- ============================================================================
-- Migration: 20260924100000_workflow_engine_tables.sql
-- Ziel: Deklarative Embedded Workflow Engine (DSL) für Notariatsworkflows
-- Tabellen: workflow_definitions, workflow_instances mit strikter Mandantentrennung (RLS)
-- ============================================================================

-- 1. Tabelle für versionierte Workflow-Definitionen (Ablaufpläne pro Falltyp)
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 1,
    case_type TEXT NOT NULL,
    title TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = System-Default-Vorlage
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indizes für schnelle Suche nach Falltyp und Kanzlei
CREATE INDEX IF NOT EXISTS idx_workflow_defs_lookup 
ON workflow_definitions(case_type, organization_id);

-- 2. Tabelle für instanziierte Workflows pro Vorgang/Dossier
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_definition_id TEXT NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,
    case_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    current_step_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    step_states JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(case_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_lookup 
ON workflow_instances(organization_id, case_id);

-- 3. Row-Level Security (RLS) aktivieren
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

-- 4. RLS-Policies für workflow_definitions:
-- Lesen: Globale Templates (organization_id IS NULL) ODER Templates der eigenen Organisation
CREATE POLICY "Users can read global or own org workflow definitions"
ON workflow_definitions
FOR SELECT
TO authenticated
USING (
    organization_id IS NULL 
    OR organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid()
    )
);

-- Schreiben: Nur Kanzlei-Admins/Notare für die eigene Organisation
CREATE POLICY "Admins can manage own org workflow definitions"
ON workflow_definitions
FOR ALL
TO authenticated
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid()
          AND om.role IN ('NOTAR', 'ADMIN')
    )
)
WITH CHECK (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid()
          AND om.role IN ('NOTAR', 'ADMIN')
    )
);

-- 5. RLS-Policies für workflow_instances:
-- Hermetische Kanzleitrennung: Zugriff nur auf Instanzen der eigenen Organisation
CREATE POLICY "Users can read own org workflow instances"
ON workflow_instances
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert own org workflow instances"
ON workflow_instances
FOR INSERT
TO authenticated
WITH CHECK (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update own org workflow instances"
ON workflow_instances
FOR UPDATE
TO authenticated
USING (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid()
    )
)
WITH CHECK (
    organization_id IN (
        SELECT om.organization_id 
        FROM organization_members om 
        WHERE om.user_id = auth.uid()
    )
);
