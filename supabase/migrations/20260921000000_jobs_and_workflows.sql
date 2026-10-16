-- ============================================================================
-- Domain-Migration 03: Jobs Queue & Workflow Engine
-- Consolidated Migration (gem. AGENTS.md Invariante 8)
-- Enthält: dossier_jobs (Queue & Webhook/Notify Trigger),
--          workflow_definitions, workflow_instances & Workflow-RLS-Policies,
--          Supabase Object Storage (dossier-files Bucket & Tenant-RLS)
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

DROP POLICY IF EXISTS "Allow all access to dossier_jobs for prototype" ON dossier_jobs;
DROP POLICY IF EXISTS rls_jobs_all ON dossier_jobs;
-- Löschen nur für Rollen mit DELETE_DOSSIER (Spiegel von src/lib/auth/rbac.ts, abgesichert durch rbac-sql-parity.test.ts).
DROP POLICY IF EXISTS rls_jobs_select ON dossier_jobs;
CREATE POLICY rls_jobs_select ON dossier_jobs FOR SELECT USING (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_jobs_insert ON dossier_jobs;
CREATE POLICY rls_jobs_insert ON dossier_jobs FOR INSERT WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_jobs_update ON dossier_jobs;
CREATE POLICY rls_jobs_update ON dossier_jobs FOR UPDATE USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS rls_jobs_delete ON dossier_jobs;
CREATE POLICY rls_jobs_delete ON dossier_jobs FOR DELETE USING (get_user_role(organization_id) IN ('NOTAR', 'NOTARASSESSOR', 'ADMIN'));

-- 2. Supabase Object Storage (dossier-files Bucket & RLS gem. § 203 StGB)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('dossier-files', 'dossier-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "RLS dossier_files select" ON storage.objects;
CREATE POLICY "RLS dossier_files select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dossier-files'
  AND is_org_member((storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "RLS dossier_files insert" ON storage.objects;
CREATE POLICY "RLS dossier_files insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dossier-files'
  AND is_org_member((storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "RLS dossier_files delete" ON storage.objects;
CREATE POLICY "RLS dossier_files delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dossier-files'
  AND get_user_role((storage.foldername(name))[1]::uuid) IN ('NOTAR', 'NOTARASSESSOR', 'ADMIN')
);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

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

-- 5. Standard Workflow-Vorlagen (Global, organization_id = NULL)
INSERT INTO workflow_definitions (id, version, case_type, title, organization_id, steps)
VALUES 
(
    'wf_def_immobilienkauf_standard',
    1,
    'IMMOBILIENKAUF',
    'Standardablauf Immobilienkaufvertrag (§ 311b BGB)',
    NULL,
    '[
        {"id": "step_ingestion_extraction", "title": "Urkunden- & Sachverhaltserfassung", "type": "EXTRACTION", "actor": "AGENT", "action": "extract_documents", "isOptional": false, "description": "Multimodale Erfassung von Grundbuchauszug, Verträgen und Ausweisen mit Belegnachweisen."},
        {"id": "step_guardrails", "title": "Deterministische Notar-Guardrails", "type": "GUARDRAILS", "actor": "SYSTEM", "action": "apply_guardrails", "isOptional": false, "description": "Prüfung von Fristen (10 Jahre GEG), Arithmetik (Parzellenflächen, Mieten) und Identitäten."},
        {"id": "step_gwg_gate", "title": "Geldwäsche-Sonderprüfung (GWG)", "type": "CONDITIONAL_GATE", "actor": "AGENT", "action": "verify_gwg_threshold", "condition": {"field": "kaufpreis", "operator": "GREATER_THAN", "value": 1000000}, "isOptional": false, "description": "Automatische Sonderprüfung bei Transaktionsvolumen über 1.000.000 €."},
        {"id": "step_notary_auditor", "title": "Notarielle Vorprüfung, Fristen & Plausibilisierung", "type": "AUDITOR", "actor": "AGENT", "action": "audit_dossier", "isOptional": false, "description": "JIT-Regelprüfung gegen Kanzlei-Knowledge und Erstellung von Nachforderungen."},
        {"id": "step_human_approval", "title": "Notarfreigabe & Entwurfsabnahme", "type": "HUMAN_APPROVAL", "actor": "NOTAR", "action": "approve_dossier", "isOptional": false, "description": "Rechtsverbindliche Abschlussfreigabe durch Notar oder Sachbearbeitung (§ 17 BeurkG)."}
    ]'::jsonb
),
(
    'wf_def_gmbh_gruendung_standard',
    1,
    'GMBH_GRUENDUNG',
    'Standardablauf GmbH-Gründung (§ 2 GmbHG)',
    NULL,
    '[
        {"id": "step_ingestion_extraction", "title": "Erfassung der Gründungsunterlagen", "type": "EXTRACTION", "actor": "AGENT", "action": "extract_documents", "isOptional": false, "description": "Extraktion von Gesellschafterdaten, Stammkapital und Unternehmensgegenstand."},
        {"id": "step_guardrails", "title": "Stammkapital- & Satzungs-Guardrails", "type": "GUARDRAILS", "actor": "SYSTEM", "action": "apply_guardrails", "isOptional": false, "description": "Validierung des Mindeststammkapitals (25.000 € gem. § 5 GmbHG) und Bareinlagen."},
        {"id": "step_notary_auditor", "title": "Notarielle Satzungsprüfung", "type": "AUDITOR", "actor": "AGENT", "action": "audit_dossier", "isOptional": false, "description": "Prüfung auf genehmigungsbedürftige Gegenstände (§ 34c GewO etc.) und Vertretungsregeln."},
        {"id": "step_human_approval", "title": "Notarfreigabe Gründungsurkunde", "type": "HUMAN_APPROVAL", "actor": "NOTAR", "action": "approve_dossier", "isOptional": false, "description": "Abschlussprüfung durch den Notar vor Beurkundungstermin."}
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    steps = EXCLUDED.steps,
    title = EXCLUDED.title,
    version = EXCLUDED.version;

