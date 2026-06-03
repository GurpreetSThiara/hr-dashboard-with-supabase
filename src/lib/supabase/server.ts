import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

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

/**
 * Extracts the user's authentication token from headers or cookies,
 * and retrieves the verified user from Supabase.
 */
export async function getServerUser(request: NextRequest, supabaseClient: SupabaseClient) {
  // Try Authorization header first
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    // Parse all cookies into a map
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies: Record<string, string> = {};
    for (const part of cookieHeader.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (name) cookies[name] = value;
    }

    // 1. Legacy: explicit access-token cookie
    if (cookies['sb-access-token']) {
      token = decodeURIComponent(cookies['sb-access-token']);
    } else {
      // 2. @supabase/ssr stores the session under sb-<ref>-auth-token. It may be
      //    split into chunked cookies (…-auth-token.0, .1, …) and is typically
      //    base64-encoded with a "base64-" prefix. Reassemble, decode, parse.
      const projectRef =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || '';
      const base = `sb-${projectRef}-auth-token`;

      const chunkNames = Object.keys(cookies)
        .filter((n) => n === base || n.startsWith(`${base}.`))
        .sort((a, b) => {
          const ai = a === base ? -1 : parseInt(a.slice(base.length + 1), 10);
          const bi = b === base ? -1 : parseInt(b.slice(base.length + 1), 10);
          return ai - bi;
        });

      if (chunkNames.length > 0) {
        let raw = chunkNames.map((n) => decodeURIComponent(cookies[n])).join('');
        try {
          if (raw.startsWith('base64-')) {
            raw = Buffer.from(raw.slice('base64-'.length), 'base64').toString('utf-8');
          }
          const parsed = JSON.parse(raw);
          const session = Array.isArray(parsed) ? parsed[0] : parsed;
          token = session?.access_token || null;
        } catch {
          token = null;
        }
      }
    }
  }

  if (!token) {
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

/** Convenience: returns a JSON-friendly error explaining what's missing. */
export function envMisconfiguredError(detail: string) {
  return {
    error: detail,
    hint: 'Add SUPABASE_SERVICE_ROLE_KEY to your .env file. Find it in Supabase Dashboard → Project Settings → API → service_role secret.',
  };
}
