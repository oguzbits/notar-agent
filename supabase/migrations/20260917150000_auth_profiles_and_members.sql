-- ============================================================================
-- Migration: 20260917150000_auth_profiles_and_members.sql
-- Ziel: Produktionsreifes Benutzermanagement & Profile für Kanzlei-Isolation
-- ============================================================================

-- 1. Profile-Tabelle (spiegelt auth.users im public-Schema wider)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS auf profiles aktivieren
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. Automatischer Trigger bei Benutzerregistrierung (Supabase Auth -> Public Profiles)
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

-- 3. organization_members Anpassung: user_id kann NULL sein für ausstehende Einladungen
ALTER TABLE public.organization_members
ALTER COLUMN user_id DROP NOT NULL;

-- 4. organization_members RLS Policies aktivieren
DROP POLICY IF EXISTS rls_org_members_select ON public.organization_members;
CREATE POLICY rls_org_members_select ON public.organization_members
    FOR SELECT USING (
        -- Jeder authentifizierte Benutzer sieht Mitglieder seiner Kanzlei
        is_org_member(organization_id)
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS rls_org_members_insert ON public.organization_members;
CREATE POLICY rls_org_members_insert ON public.organization_members
    FOR INSERT WITH CHECK (
        get_user_role(organization_id) IN ('NOTAR', 'ADMIN')
        OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = organization_members.organization_id)
    );

DROP POLICY IF EXISTS rls_org_members_update ON public.organization_members;
CREATE POLICY rls_org_members_update ON public.organization_members
    FOR UPDATE USING (
        get_user_role(organization_id) IN ('NOTAR', 'ADMIN')
    );

DROP POLICY IF EXISTS rls_org_members_delete ON public.organization_members;
CREATE POLICY rls_org_members_delete ON public.organization_members
    FOR DELETE USING (
        get_user_role(organization_id) IN ('NOTAR', 'ADMIN')
    );
