import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateEnv } from '@/env';

/**
 * Creates an SSR Supabase client bound to Next.js server cookie store.
 * Suitable for API Route Handlers, Server Actions, and Server Components.
 */
export async function createServerAuthClient() {
  const cookieStore = await cookies();
  const env = validateEnv(process.env);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createServerClient(supabaseUrl, supabaseKey, {
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
