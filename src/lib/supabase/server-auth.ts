import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateEnv } from '@/env';
import { Database } from '@/types/database';

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
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
