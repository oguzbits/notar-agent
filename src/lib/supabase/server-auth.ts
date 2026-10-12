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
 * Löst die Kanzlei-ID des aktuell authentifizierten Benutzers aus der Sitzung auf.
 * Beachtet einen expliziten Override (z.B. aus Header/Query), falls vorhanden.
 */
export async function resolveSessionOrganizationId(
  authSupabase: ReturnType<typeof createServerClient<Database>> | null,
  overrideOrgId?: string
): Promise<string | undefined> {
  if (overrideOrgId) return overrideOrgId;
  if (!authSupabase) return undefined;

  try {
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) return undefined;

    const { data: member } = await authSupabase
      .from(DB_TABLES.ORGANIZATION_MEMBERS)
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    return (member as { organization_id?: string } | null)?.organization_id ?? undefined;
  } catch (err: unknown) {
    console.debug('Fehler beim Auflösen der Kanzlei-ID aus der Sitzung:', err);
    return undefined;
  }
}
