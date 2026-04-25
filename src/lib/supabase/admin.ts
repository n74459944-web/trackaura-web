import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client — uses the service role key and bypasses RLS.
 *
 * ONLY import this from server-side code (server components, server actions,
 * route handlers). Never import in a client component. The service role key
 * must never be shipped to the browser.
 *
 * This is deliberately separate from lib/supabase/server.ts, which uses the
 * anon key + SSR cookies for user-facing reads. Admin writes on
 * canonical_entities go through this client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
