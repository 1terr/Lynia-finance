import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client for API routes.
 *
 * Requires two environment variables:
 *   SUPABASE_URL        – project URL  (e.g. https://xyz.supabase.co)
 *   SUPABASE_SERVICE_KEY – service-role key (never expose to the browser)
 *
 * Throws at call time if either is missing so API routes return a clear
 * 503 instead of silently failing.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
