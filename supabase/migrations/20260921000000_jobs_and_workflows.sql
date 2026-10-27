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
        {"id": "step_guardrails", "title": "Deterministische Notar-Guardrails", "type": "GUARDRAILS", "actor": "SYSTEM", "action": "apply_guardrails", "isOptional": false, "description": "Prüfung von Fristen, Arithmetik (Parzellenflächen, Mieten) und Identitäten."},
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
        {"id": "step_guardrails", "title": "Stammkapital- & Satzungs-Guardrails", "type": "GUARDRAILS", "actor": "SYSTEM", "action": "apply_guardrails", "isOptional": false, "description": "Validierung des Mindeststammkapitals und der Einlagen."},
        {"id": "step_notary_auditor", "title": "Notarielle Satzungsprüfung", "type": "AUDITOR", "actor": "AGENT", "action": "audit_dossier", "isOptional": false, "description": "Prüfung auf genehmigungsbedürftige Gegenstände (§ 34c GewO etc.) und Vertretungsregeln."},
        {"id": "step_human_approval", "title": "Notarfreigabe Gründungsurkunde", "type": "HUMAN_APPROVAL", "actor": "NOTAR", "action": "approve_dossier", "isOptional": false, "description": "Abschlussprüfung durch den Notar vor Beurkundungstermin."}
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    steps = EXCLUDED.steps,
    title = EXCLUDED.title,
    version = EXCLUDED.version;



-- ============================================================================
-- Löschpipeline: Outbox für Storage-Objekte und transaktionale Löschfunktionen
-- ============================================================================

CREATE TABLE IF NOT EXISTS deletion_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'FAILED')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, storage_path)
);
CREATE INDEX IF NOT EXISTS idx_deletion_tasks_queue ON deletion_tasks(status, created_at);
ALTER TABLE deletion_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_deletion_tasks_select ON deletion_tasks;
CREATE POLICY rls_deletion_tasks_select ON deletion_tasks FOR SELECT USING (is_org_member(organization_id));

-- Interne Routine: löscht ein Dossier samt abhängiger Daten, legt Storage-Aufgaben an und schreibt den Nachweis.
-- Keine Prüfung der Berechtigung hier; die öffentlichen Funktionen davor erzwingen sie.
CREATE OR REPLACE FUNCTION _purge_dossier(p_document_id TEXT, p_reason TEXT, p_actor TEXT) RETURNS JSONB AS $$
DECLARE
    v_org UUID;
    v_prefix TEXT;
    n_docs INT; n_jobs INT; n_wf INT; n_map INT; n_tasks INT; n_kn INT;
    v_rows JSONB;
BEGIN
    IF p_reason NOT IN ('ENTWURF_VERWORFEN', 'FEHLERHAFT_ANGELEGT', 'AUFBEWAHRUNG_ABGELAUFEN', 'SONSTIGES') THEN
        RAISE EXCEPTION 'Unbekannter Löschgrund' USING ERRCODE = '22023';
    END IF;

    SELECT organization_id INTO v_org FROM documents WHERE id = p_document_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vorgang nicht gefunden' USING ERRCODE = 'P0002';
    END IF;
    -- Auch Analysen eines bestehenden Dossiers (payload.documentId) zählen; result_dossier_id ist erst bei COMPLETED gesetzt
    IF EXISTS (SELECT 1 FROM dossier_jobs
               WHERE (result_dossier_id = p_document_id OR payload->>'documentId' = p_document_id)
                 AND organization_id = v_org AND status IN ('PENDING', 'PROCESSING') FOR UPDATE) THEN
        RAISE EXCEPTION 'Für den Vorgang läuft noch eine Verarbeitung' USING ERRCODE = '55006';
    END IF;

    v_prefix := v_org::text || '/';

    -- Storage-Objekte vormerken, bevor die Jobs verschwinden; nur Pfade der eigenen Kanzlei
    INSERT INTO deletion_tasks (organization_id, document_id, storage_path)
    SELECT v_org, p_document_id, path FROM (
        SELECT f->>'storagePath' AS path
        FROM dossier_jobs j,
             jsonb_array_elements(CASE WHEN jsonb_typeof(j.payload->'files') = 'array'
                                       THEN j.payload->'files' ELSE '[]'::jsonb END) f
        WHERE (j.result_dossier_id = p_document_id OR j.payload->>'documentId' = p_document_id)
          AND j.organization_id = v_org
        UNION
        SELECT o.name FROM storage.objects o
        WHERE o.bucket_id = 'dossier-files'
          AND left(o.name, length(v_prefix || 'archive/' || p_document_id || '/')) = v_prefix || 'archive/' || p_document_id || '/'
    ) src
    -- Upload-Pfade genau <Kanzlei>/<Datei>; Archivpfade nur aus dem Listing (Pfade aus Job-Payloads sind Client-Eingaben)
    WHERE path IS NOT NULL AND left(path, length(v_prefix)) = v_prefix AND position('..' IN path) = 0
      AND (position('/' IN substr(path, length(v_prefix) + 1)) = 0
           OR left(path, length(v_prefix || 'archive/' || p_document_id || '/')) = v_prefix || 'archive/' || p_document_id || '/')
    ON CONFLICT (document_id, storage_path) DO NOTHING;
    GET DIAGNOSTICS n_tasks = ROW_COUNT;

    DELETE FROM workflow_instances WHERE case_id = p_document_id AND organization_id = v_org;
    GET DIAGNOSTICS n_wf = ROW_COUNT;
    DELETE FROM dossier_jobs
    WHERE (result_dossier_id = p_document_id OR payload->>'documentId' = p_document_id) AND organization_id = v_org;
    GET DIAGNOSTICS n_jobs = ROW_COUNT;
    DELETE FROM knowledge_documents WHERE organization_id = v_org AND legal_basis = 'dossier:' || p_document_id;
    GET DIAGNOSTICS n_kn = ROW_COUNT;
    DELETE FROM documents WHERE id = p_document_id AND organization_id = v_org;
    GET DIAGNOSTICS n_docs = ROW_COUNT;

    -- Nachweis zuerst, Zuordnung der Pseudonyme zuletzt: Auch dieser Eintrag ist danach nicht mehr personenbeziehbar
    v_rows := jsonb_build_object('documents', n_docs, 'dossier_jobs', n_jobs, 'workflow_instances', n_wf, 'knowledge_documents', n_kn);
    INSERT INTO audit_logs (organization_id, document_id, action, actor, details)
    VALUES (v_org, p_document_id, 'DOSSIER_DELETED', p_actor, jsonb_build_object('deletion',
        jsonb_build_object('reason', p_reason, 'deletedRows', v_rows, 'storageTasks', n_tasks)));

    -- Ohne Storage-Objekte ist die Löschung sofort vollständig (vor dem Entfernen der Zuordnung, sonst legt der Trigger sie neu an)
    IF n_tasks = 0 THEN
        INSERT INTO audit_logs (organization_id, document_id, action, actor, details)
        VALUES (v_org, p_document_id, 'DOSSIER_PURGE_COMPLETED', 'SYSTEM', '{}'::jsonb);
    END IF;

    DELETE FROM audit_actor_map WHERE document_id = p_document_id AND organization_id = v_org;
    GET DIAGNOSTICS n_map = ROW_COUNT;
    v_rows := v_rows || jsonb_build_object('audit_actor_map', n_map);

    RETURN jsonb_build_object('documentId', p_document_id, 'deletedRows', v_rows, 'storageTasks', n_tasks);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION delete_dossier(p_document_id TEXT, p_reason TEXT) RETURNS JSONB AS $$
DECLARE
    v_org UUID;
    v_role notary_role;
BEGIN
    SELECT organization_id INTO v_org FROM documents WHERE id = p_document_id;
    v_role := CASE WHEN v_org IS NULL THEN NULL ELSE get_user_role(v_org) END;
    -- Nichtmitglieder erfahren nicht, ob die ID existiert
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Vorgang nicht gefunden' USING ERRCODE = 'P0002';
    END IF;
    IF v_role::text NOT IN ('NOTAR', 'NOTARASSESSOR', 'ADMIN') THEN
        RAISE EXCEPTION 'Keine Berechtigung zum Löschen' USING ERRCODE = '42501';
    END IF;
    RETURN _purge_dossier(p_document_id, p_reason, COALESCE(
        (SELECT display_name FROM audit_actor_map WHERE document_id = p_document_id AND user_id = auth.uid()),
        (SELECT NULLIF(full_name, '') FROM public.profiles WHERE id = auth.uid()),
        'Nutzer'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION delete_dossier_system(p_document_id TEXT) RETURNS JSONB AS $$
    SELECT _purge_dossier(p_document_id, 'AUFBEWAHRUNG_ABGELAUFEN', 'SYSTEM');
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION complete_dossier_purge(p_document_id TEXT) RETURNS BOOLEAN AS $$
DECLARE
    v_org UUID;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_document_id, 1));
    SELECT organization_id INTO v_org FROM deletion_tasks WHERE document_id = p_document_id LIMIT 1;
    IF v_org IS NULL THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM audit_logs WHERE document_id = p_document_id AND organization_id = v_org AND action = 'DOSSIER_PURGE_COMPLETED') THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM deletion_tasks WHERE document_id = p_document_id AND status <> 'DONE') THEN
        RETURN false;
    END IF;
    INSERT INTO audit_logs (organization_id, document_id, action, actor, details)
    VALUES (v_org, p_document_id, 'DOSSIER_PURGE_COMPLETED', 'SYSTEM', '{}'::jsonb);
    -- Dateinamen können Mandantendaten enthalten: nach dem Nachweis nicht mehr aufbewahren
    DELETE FROM deletion_tasks WHERE document_id = p_document_id AND organization_id = v_org;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION _purge_dossier(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION delete_dossier(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_dossier(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION delete_dossier_system(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_dossier_system(TEXT) TO service_role;
REVOKE ALL ON FUNCTION complete_dossier_purge(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_dossier_purge(TEXT) TO service_role;

-- Fällige Dossiers: Anker gesetzt und längste geprüfte, gültige Frist (global oder eigene Kanzlei) abgelaufen.
-- Ohne Fristdatensatz liefert die Funktion nichts (fail-closed).
CREATE OR REPLACE FUNCTION list_retention_expired_dossiers(p_limit INT)
RETURNS TABLE (id TEXT, organization_id UUID) AS $$
    SELECT d.id, d.organization_id
    FROM documents d
    JOIN LATERAL (
        SELECT max(k.retention_years) AS years
        FROM knowledge_documents k
        WHERE k.retention_years IS NOT NULL
          AND k.review_status = 'GEPRUEFT'
          AND (k.organization_id IS NULL OR k.organization_id = d.organization_id)
          AND (k.valid_from IS NULL OR k.valid_from <= current_date)
          AND (k.valid_until IS NULL OR k.valid_until >= current_date)
    ) r ON r.years IS NOT NULL
    WHERE d.retention_anchor_at IS NOT NULL
      AND d.retention_anchor_at + make_interval(years => r.years) <= now()
    ORDER BY d.retention_anchor_at
    LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION list_retention_expired_dossiers(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION list_retention_expired_dossiers(INT) TO service_role;


-- ============================================================================
-- Verbrauchserfassung: Tokens je Modellaufruf, Preise als Daten, Kosten per View
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id TEXT,
    stage TEXT NOT NULL CHECK (stage IN ('extraktion', 'pruefung')),
    model TEXT NOT NULL,
    input_tokens INT NOT NULL CHECK (input_tokens >= 0),
    output_tokens INT NOT NULL CHECK (output_tokens >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_org_created ON llm_usage(organization_id, created_at);
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
-- Append-only: nur Lesen und Einfügen für Mitglieder der Kanzlei, kein UPDATE/DELETE
DROP POLICY IF EXISTS rls_llm_usage_select ON llm_usage;
CREATE POLICY rls_llm_usage_select ON llm_usage FOR SELECT USING (is_org_member(organization_id));
DROP POLICY IF EXISTS rls_llm_usage_insert ON llm_usage;
CREATE POLICY rls_llm_usage_insert ON llm_usage FOR INSERT WITH CHECK (is_org_member(organization_id));

-- Preise je Million Token in USD; gepflegt als Daten (ohne Eintrag bleibt der Betrag NULL).
CREATE TABLE IF NOT EXISTS model_prices (
    model TEXT PRIMARY KEY,
    input_usd_per_mtok NUMERIC NOT NULL CHECK (input_usd_per_mtok >= 0),
    output_usd_per_mtok NUMERIC NOT NULL CHECK (output_usd_per_mtok >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE model_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_model_prices_select ON model_prices;
CREATE POLICY rls_model_prices_select ON model_prices FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE VIEW llm_usage_costs WITH (security_invoker = true) AS
SELECT u.*,
       (u.input_tokens * p.input_usd_per_mtok + u.output_tokens * p.output_usd_per_mtok) / 1000000 AS cost_usd
FROM llm_usage u
LEFT JOIN model_prices p ON p.model = u.model;
