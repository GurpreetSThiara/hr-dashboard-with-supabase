import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

/**
 * Server-side Supabase client. Prefers the service-role key (bypasses RLS),
 * falls back to anon. Returns null if neither is configured. Call lazily inside
 * route handlers, never at module load.
 */
export function getServerSupabase(): { client: SupabaseClient; hasServiceRole: boolean } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) return null;
  if (serviceKey) {
    return { client: createClient(url, serviceKey, { auth: { persistSession: false } }), hasServiceRole: true };
  }
  if (anonKey) {
    return { client: createClient(url, anonKey, { auth: { persistSession: false } }), hasServiceRole: false };
  }
  return null;
}

/** Extracts the auth token from headers/cookies and returns the verified user. */
export async function getServerUser(request: NextRequest, supabaseClient: SupabaseClient) {
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies: Record<string, string> = {};
    for (const part of cookieHeader.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (name) cookies[name] = value;
    }

    if (cookies['sb-access-token']) {
      token = decodeURIComponent(cookies['sb-access-token']);
    } else {
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

  if (!token) return null;
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}
