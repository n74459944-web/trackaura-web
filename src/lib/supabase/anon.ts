import { createClient as createAnonClient } from '@supabase/supabase-js';

/**
 * Supabase client for **build-time** reads — sitemaps, generateStaticParams,
 * ISR prerender, anywhere that runs outside a request context.
 *
 * This client does NOT touch cookies(), so it's safe to call from
 * generateSitemaps / generateStaticParams during `next build`. Use the
 * server.ts createClient for anything inside a Server Component that
 * renders per-request.
 *
 * Forces `cache: 'no-store'` on every underlying fetch. Without this, Next.js
 * can serve stale empty responses captured during a previous transient backend
 * issue (e.g. Supabase outage 2026-04-27) for the lifetime of the build cache.
 * Build-time reads of dynamic catalog data must always be fresh — caching
 * happens at the route layer (ISR `revalidate`), not the fetch layer.
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
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
