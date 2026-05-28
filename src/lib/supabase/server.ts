import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a server-side Supabase client. Prefers the service-role key when
 * available (full admin access, bypasses RLS), otherwise falls back to the
 * anon key. Returns null if neither is configured.
 *
 * IMPORTANT: Call this lazily inside route handlers — never at module load —
 * so that missing env vars produce a JSON 500 instead of crashing the route
 * file at import time.
 */
export function getServerSupabase(): { client: SupabaseClient; hasServiceRole: boolean } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) return null;

  if (serviceKey) {
    return {
      client: createClient(url, serviceKey, { auth: { persistSession: false } }),
      hasServiceRole: true,
    };
  }
  if (anonKey) {
    return {
      client: createClient(url, anonKey, { auth: { persistSession: false } }),
      hasServiceRole: false,
    };
  }
  return null;
}

/** Convenience: returns a JSON-friendly error explaining what's missing. */
export function envMisconfiguredError(detail: string) {
  return {
    error: detail,
    hint: 'Add SUPABASE_SERVICE_ROLE_KEY to your .env file. Find it in Supabase Dashboard → Project Settings → API → service_role secret.',
  };
}
