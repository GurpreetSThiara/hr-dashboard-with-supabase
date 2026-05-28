import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

// POST — validates credentials against Supabase auth. Login UI now uses
// the client-side Supabase auth helper directly; this endpoint is kept
// for backward compatibility with anything that still calls it.
export async function POST(req: NextRequest) {
  try {
    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json(
        { error: 'Supabase is not configured on the server.' },
        { status: 500 }
      );
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { data, error } = await conn.client.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });

    // Pull profile from users table for role/tier
    const { data: profile } = await conn.client
      .from('users')
      .select('role, tier, full_name, department')
      .eq('id', data.user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      user: { ...data.user, ...profile },
      session: data.session,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to process login' }, { status: 500 });
  }
}
