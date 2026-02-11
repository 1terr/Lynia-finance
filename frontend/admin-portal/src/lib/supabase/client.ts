import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // During static generation (next build with output: 'export'), client
    // components are pre-rendered server-side.  The Supabase client is never
    // actually *used* at build time (event handlers don't fire), so we can
    // safely return null to avoid crashing the build.
    if (typeof window === 'undefined') {
      return null as unknown as ReturnType<typeof createBrowserClient>;
    }
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
