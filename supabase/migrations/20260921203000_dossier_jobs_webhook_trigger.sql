-- ============================================================================
-- Migration: 20260921203000_dossier_jobs_webhook_trigger.sql
-- Ziel: Automatischer Trigger bei Job-Erstellung oder Rückstellung auf PENDING
-- Löst den Long-Polling-Daemon ab und sendet Database-Events via Supabase Webhook.
-- ============================================================================

-- 1. Helper-Funktion zum Senden des Webhook-Events (falls pg_net vorhanden)
-- Supabase bietet standardmäßig pg_net oder Dashboard-Webhooks.
-- Dieser Trigger bereitet das deterministische Audit & Notification-Event vor:

CREATE OR REPLACE FUNCTION notify_dossier_job_pending()
RETURNS TRIGGER AS $$
BEGIN
    -- Nur auslösen, wenn der Status neu ist und auf PENDING steht
    IF (TG_OP = 'INSERT' AND NEW.status = 'PENDING') OR 
       (TG_OP = 'UPDATE' AND NEW.status = 'PENDING' AND (OLD.status IS DISTINCT FROM 'PENDING')) THEN
        
        -- Native PostgreSQL NOTIFY für Realtime/Listener
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

-- 2. Trigger anlegen
DROP TRIGGER IF EXISTS trigger_dossier_job_pending ON dossier_jobs;

CREATE TRIGGER trigger_dossier_job_pending
AFTER INSERT OR UPDATE ON dossier_jobs
FOR EACH ROW
EXECUTE FUNCTION notify_dossier_job_pending();
