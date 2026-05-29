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
  console.log("getServerUser DEBUG: authHeader =", authHeader);

  if (!token) {
    // Try cookies
    const cookieHeader = request.headers.get('cookie') || '';
    console.log("getServerUser DEBUG: cookieHeader =", cookieHeader);
    
    // 1. Try sb-access-token
    const matchAccessToken = cookieHeader.match(/(^|;)\s*sb-access-token\s*=\s*([^;]+)/);
    if (matchAccessToken) {
      token = decodeURIComponent(matchAccessToken[2]);
      console.log("getServerUser DEBUG: Found sb-access-token cookie");
    } else {
      // 2. Try sb-<project-ref>-auth-token
      const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || '';
      const cookieName = `sb-${projectRef}-auth-token`;
      const matchAuthToken = cookieHeader.match(new RegExp('(^|;)\\s*' + cookieName + '\\s*=\\s*([^;]+)'));
      if (matchAuthToken) {
        try {
          const parsed = JSON.parse(decodeURIComponent(matchAuthToken[2]));
          token = parsed.access_token || parsed;
          console.log("getServerUser DEBUG: Found project-ref-auth-token cookie");
        } catch {
          token = matchAuthToken[2];
          console.log("getServerUser DEBUG: Found project-ref-auth-token cookie (fallback)");
        }
      }
    }
  }

  if (!token) {
    console.log("getServerUser DEBUG: No token found in headers or cookies");
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error) {
      console.log("getServerUser DEBUG: getUser error =", error.message);
      return null;
    }
    if (!user) {
      console.log("getServerUser DEBUG: No user returned");
      return null;
    }
    console.log("getServerUser DEBUG: Authenticated user =", user.email);
    return user;
  } catch (err: any) {
    console.log("getServerUser DEBUG: getUser catch err =", err?.message || err);
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
