import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateEnv } from '@/env';
import { DB_TABLES, Database } from '@/types/database';

/**
 * Creates an SSR Supabase client bound to Next.js server cookie store.
 * Suitable for API Route Handlers, Server Actions, and Server Components.
 */
export async function createServerAuthClient() {
  let cookieStore;
  try {
    cookieStore = await cookies();
  } catch (cookieError: unknown) {
    // In unit test or non-request contexts, next/headers cookies() throws
    console.debug('Cookie store unavailable in current context:', cookieError);
    return null;
  }
  const env = validateEnv(process.env);
  const supabaseUrl = env.NEXT_SUPABASE_URL;
  const supabaseKey = env.NEXT_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch (cookieError) {
          // The `setAll` method was called from a Server Component.
          // In Next.js SSR, cookies cannot be set during RSC render.
          console.warn('Cookies cannot be set during RSC render:', cookieError);
        }
      },
    },
  });
}

/**
 * Löst die Kanzlei-ID des angemeldeten Benutzers ausschließlich aus der serverseitig
 * validierten Sitzung und der Mitgliedschaft auf. Eine angeforderte Kanzlei (z.B. aus Header
 * oder Query) gilt nur, wenn der Benutzer dort Mitglied ist; sie ist nie selbst eine Berechtigung.
 * Rückgabe `undefined` bedeutet: nicht angemeldet, keine Mitgliedschaft oder fremde Kanzlei.
 */
export async function resolveSessionOrganizationId(
  authSupabase: ReturnType<typeof createServerClient<Database>> | null,
  requestedOrgId?: string
): Promise<string | undefined> {
  if (!authSupabase) return undefined;

  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();
  if (authError || !user) return undefined;

  const { data: memberships, error: memberError } = await authSupabase
    .from(DB_TABLES.ORGANIZATION_MEMBERS)
    .select('organization_id')
    .eq('user_id', user.id);
  if (memberError) {
    throw new Error(`Mitgliedschaft konnte nicht geladen werden: ${memberError.message}`);
  }

  const organizationIds = (memberships ?? []).map((m) => m.organization_id);
  if (requestedOrgId) {
    return organizationIds.includes(requestedOrgId) ? requestedOrgId : undefined;
  }
  return organizationIds[0];
}

export interface SessionActor {
  userId: string;
  /** Anzeigename für den Audit-Trail, aus Profil bzw. E-Mail der Sitzung. */
  label: string;
  /** Berufsrechtliche Rolle in der angegebenen Kanzlei, aus der Mitgliedschaft. */
  role: string;
}

/**
 * Bestimmt Akteur und Rolle ausschließlich aus Sitzung und Mitgliedschaft (nie aus dem Request-Body).
 */
export async function resolveSessionActor(
  authSupabase: ReturnType<typeof createServerClient<Database>>,
  organizationId: string
): Promise<SessionActor | undefined> {
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) return undefined;

  const { data: member, error: memberError } = await authSupabase
    .from(DB_TABLES.ORGANIZATION_MEMBERS)
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (memberError) {
    throw new Error(`Rolle konnte nicht geladen werden: ${memberError.message}`);
  }
  if (!member) return undefined;

  const { data: profile } = await authSupabase
    .from(DB_TABLES.PROFILES)
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  return { userId: user.id, label: profile?.full_name || user.email || user.id, role: member.role };
}
