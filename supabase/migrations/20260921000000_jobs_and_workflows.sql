-- ============================================================================
-- Domain-Migration 03: Jobs Queue & Workflow Engine
-- Consolidated Migration (gem. AGENTS.md Invariante 8)
-- Enthält: dossier_jobs (Queue & Webhook/Notify Trigger),
--          workflow_definitions, workflow_instances & Workflow-RLS-Policies
-- ============================================================================

-- 1. Dossier Jobs (Asynchrone Verarbeitungs-Queue)
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

CREATE INDEX IF NOT EXISTS idx_jobs_org_queue 
ON dossier_jobs(organization_id, status, created_at)
WHERE status = 'PENDING';

ALTER TABLE dossier_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_jobs_all ON dossier_jobs;
CREATE POLICY rls_jobs_all ON dossier_jobs
    FOR ALL
    USING (is_org_member(organization_id))
    WITH CHECK (is_org_member(organization_id));

-- Trigger für Realtime / Webhook-Events bei neuen Jobs
CREATE OR REPLACE FUNCTION notify_dossier_job_pending()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'PENDING') OR 
       (TG_OP = 'UPDATE' AND NEW.status = 'PENDING' AND (OLD.status IS DISTINCT FROM 'PENDING')) THEN
        PERFORM pg_notify(
            'dossier_jobs_pending',
            json_build_object(
                'id', NEW.id,
                'organization_id', NEW.organization_id,
                'status', NEW.status,
                'created_at', NEW.created_at
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_dossier_job_pending ON dossier_jobs;
CREATE TRIGGER trigger_dossier_job_pending
AFTER INSERT OR UPDATE ON dossier_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_dossier_job_pending();

-- 2. Tabelle für versionierte Workflow-Definitionen (Ablaufpläne pro Falltyp)
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

CREATE INDEX IF NOT EXISTS idx_workflow_defs_lookup 
ON workflow_definitions(case_type, organization_id);

-- 3. Tabelle für instanziierte Workflows pro Vorgang/Dossier
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

ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

-- 4. RLS-Policies für Workflows
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

CREATE POLICY "Users can manage workflow instances in their organization"
ON workflow_instances
FOR ALL
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
