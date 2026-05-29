import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, role, tier } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const conn = getServerSupabase();

    // ── Path 1: service role available — use admin API ────────────────────────
    if (conn?.hasServiceRole) {
      const supabase = conn.client;

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, tier },
      });

      if (error) {
        if (error.message.includes('already exists')) {
          return NextResponse.json({ message: 'User already exists', data: null }, { status: 200 });
        }
        throw error;
      }

      if (data?.user) {
        await supabase
          .from('users')
          .upsert({ email, role: role || 'Employee', tier: tier || 15 })
          .eq('email', email);
      }

      return NextResponse.json({ data, message: 'User created successfully' });
    }

    // ── Path 2: no service role — insert directly via pg ─────────────────────
    await withPgClient(async (client) => {
      // Check if user already exists
      const existing = await client.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [email]
      );
      if (existing.rows.length > 0) return; // already exists

      const userId = crypto.randomUUID();
      await client.query(
        `INSERT INTO auth.users (
           instance_id, id, aud, role, email, encrypted_password,
           email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
           is_super_admin, created_at, updated_at, is_sso_user, is_anonymous,
           confirmation_token, recovery_token, email_change_token_new,
           email_change, email_change_token_current, reauthentication_token,
           phone_change, phone_change_token
         ) VALUES (
           '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
           crypt($3, gen_salt('bf', 10)), NOW(),
           '{"provider":"email","providers":["email"]}',
           $4,
           false, NOW(), NOW(), false, false,
           '', '', '', '', '', '', '', ''
         )`,
        [userId, email, password, JSON.stringify({ role: role || 'Employee', tier: tier || 15 })]
      );

      // Identity record
      await client.query(
        `INSERT INTO auth.identities
           (id, user_id, identity_data, provider, provider_id, email, last_sign_in_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'email', $4, $5, NOW(), NOW(), NOW())
         ON CONFLICT (provider, provider_id) DO NOTHING`,
        [
          crypto.randomUUID(),
          userId,
          JSON.stringify({ sub: userId, email }),
          email,
          email,
        ]
      );

      // Public user profile
      await client.query(
        `INSERT INTO public.users (id, email, role, tier, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, tier = EXCLUDED.tier`,
        [userId, email, role || 'Employee', tier || 15]
      );
    });

    return NextResponse.json({ data: null, message: 'User created successfully' });
  } catch (error: any) {
    console.error('Signup error:', error);
    if (error.message?.includes('already exists') || error.code === '23505') {
      return NextResponse.json({ message: 'User already exists', data: null }, { status: 200 });
    }
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
