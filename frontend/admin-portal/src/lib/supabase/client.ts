import { createBrowserClient } from '@supabase/ssr';

/**
 * Resolve Supabase config from build-time env vars or runtime config.
 *
 * With `output: 'export'`, NEXT_PUBLIC_* values are inlined at build time.
 * If the build ran without them (e.g. GitHub Actions vars not set), the
 * runtime fallback reads from `window.__LYNIA_CONFIG__` which is populated
 * by `public/config.js` (overwritten by CI/CD during deployment).
 */
function getConfig(): { url: string; key: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Runtime config fallback for static exports served from CDN
  if ((!url || !key) && typeof window !== 'undefined') {
    const cfg = (window as Record<string, unknown>).__LYNIA_CONFIG__ as
      | { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string }
      | undefined;
    if (cfg) {
      url = url || cfg.SUPABASE_URL || '';
      key = key || cfg.SUPABASE_ANON_KEY || '';
    }
  }

  return { url, key };
}

/** Returns true when Supabase URL and anon key are available. */
export function isSupabaseConfigured(): boolean {
  const { url, key } = getConfig();
  return Boolean(url && key);
}

export function createClient() {
  const { url, key } = getConfig();

  if (!url || !key) {
    // During static generation (next build with output: 'export'), client
    // components are pre-rendered server-side.  The Supabase client is never
    // actually *used* at build time (event handlers don't fire), so we can
    // safely return null to avoid crashing the build.
    //
    // In the browser, the ConfigGuard component in root layout blocks child
    // rendering when config is missing, so downstream code never sees null.
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }

  return createBrowserClient(url, key);
}
