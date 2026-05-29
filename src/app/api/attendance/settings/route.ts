import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase } from '@/lib/supabase/server';

// GET — Retrieve active attendance settings
export async function GET() {
  try {
    const data = await withPgClient(async (client) => {
      const res = await client.query("SELECT * FROM attendance_settings WHERE id = 'default' LIMIT 1");
      return res.rows[0];
    });

    if (!data) {
      return NextResponse.json({
        max_past_days_regularization: 30,
        checkin_checkout_allowed_tiers: Array.from({ length: 18 }, (_, i) => i + 1),
        enable_checkin_checkout: true,
        enable_regularizations: true,
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Update attendance settings (Restricted to tier <= 2)
export async function POST(request: NextRequest) {
  try {
    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json({ error: 'Supabase connection not configured' }, { status: 503 });
    }

    // Authenticate user
    const { data: { session } } = await conn.client.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role tier <= 2 (Super Admin / Owner)
    const profileRes = await conn.client
      .from('users')
      .select('tier')
      .eq('id', session.user.id)
      .single();

    const tier = profileRes?.data?.tier ?? 15;
    if (tier > 2) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      max_past_days_regularization,
      checkin_checkout_allowed_tiers,
      enable_checkin_checkout,
      enable_regularizations,
    } = body;

    const result = await withPgClient(async (client) => {
      const sql = `
        INSERT INTO attendance_settings 
          (id, max_past_days_regularization, checkin_checkout_allowed_tiers, enable_checkin_checkout, enable_regularizations, updated_by, updated_at)
        VALUES 
          ('default', $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          max_past_days_regularization = EXCLUDED.max_past_days_regularization,
          checkin_checkout_allowed_tiers = EXCLUDED.checkin_checkout_allowed_tiers,
          enable_checkin_checkout = EXCLUDED.enable_checkin_checkout,
          enable_regularizations = EXCLUDED.enable_regularizations,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `;
      const res = await client.query(sql, [
        max_past_days_regularization || 30,
        checkin_checkout_allowed_tiers || Array.from({ length: 18 }, (_, i) => i + 1),
        enable_checkin_checkout !== false,
        enable_regularizations !== false,
        session.user.email || 'admin'
      ]);
      return res.rows[0];
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
