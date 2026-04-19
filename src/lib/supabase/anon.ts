import { createClient as createAnonClient } from '@supabase/supabase-js';

/**
 * Supabase client for **build-time** reads — sitemaps, generateStaticParams,
 * ISR prerender, anywhere that runs outside a request context.
 *
 * This client does NOT touch cookies(), so it's safe to call from
 * generateSitemaps / generateStaticParams during `next build`. Use the
 * server.ts createClient for anything inside a Server Component that
 * renders per-request.
 */
export function createAnonSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set.',
    );
  }

  return createAnonClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
