-- ============================================================================
-- Migration: 20260917224500_organizations_insert_policy.sql
-- Ziel: Authentifizierten Benutzern erlauben, eine neue Kanzlei anzulegen
-- ============================================================================

-- Erlaube jedem authentifizierten Benutzer das Erstellen einer neuen Kanzlei
DROP POLICY IF EXISTS rls_organizations_insert ON public.organizations;
CREATE POLICY rls_organizations_insert ON public.organizations
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Absicherung: Aktualisieren oder Löschen von Kanzleidaten bleibt Notaren/Admins vorbehalten
DROP POLICY IF EXISTS rls_organizations_update ON public.organizations;
CREATE POLICY rls_organizations_update ON public.organizations
    FOR UPDATE
    TO authenticated
    USING (get_user_role(id) IN ('NOTAR', 'ADMIN'))
    WITH CHECK (get_user_role(id) IN ('NOTAR', 'ADMIN'));
