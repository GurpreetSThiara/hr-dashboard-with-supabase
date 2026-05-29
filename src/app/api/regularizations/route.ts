import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase } from '@/lib/supabase/server';
import { differenceInDays, parseISO, format } from 'date-fns';

// GET — Retrieve regularization requests for the current logged-in employee
export async function GET() {
  try {
    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json({ error: 'Supabase connection not configured' }, { status: 503 });
    }

    const { data: { session } } = await conn.client.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await withPgClient(async (client) => {
      // 1. Find employee
      const empRes = await client.query("SELECT id FROM employees WHERE email = $1", [session.user.email]);
      const emp = empRes.rows[0];
      if (!emp) return [];

      // 2. Fetch regularizations
      const regRes = await client.query(
        "SELECT * FROM attendance_regularizations WHERE employee_id = $1 ORDER BY date DESC",
        [emp.id]
      );
      return regRes.rows;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Create a new regularization request
export async function POST(request: NextRequest) {
  try {
    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json({ error: 'Supabase connection not configured' }, { status: 503 });
    }

    const { data: { session } } = await conn.client.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, requested_check_in, requested_check_out, reason } = body;

    if (!date || !reason) {
      return NextResponse.json({ error: 'Missing required fields: date and reason' }, { status: 400 });
    }

    const result = await withPgClient(async (client) => {
      // 1. Fetch settings
      const settingsRes = await client.query("SELECT * FROM attendance_settings WHERE id = 'default' LIMIT 1");
      const settings = settingsRes.rows[0] || {
        max_past_days_regularization: 30,
        enable_regularizations: true
      };

      if (!settings.enable_regularizations) {
        throw new Error('Attendance regularizations are currently disabled by global policy.');
      }

      // 2. Check date limit
      const today = new Date();
      const targetDate = parseISO(date);
      // Diff in days between today and target date
      const diff = differenceInDays(today, targetDate);

      if (diff < 0) {
        throw new Error('Regularization cannot be requested for future dates.');
      }

      if (diff > settings.max_past_days_regularization) {
        throw new Error(`Policy violation: Regularization cannot be requested more than ${settings.max_past_days_regularization} days in the past. (Selected date was ${diff} days ago)`);
      }

      // 3. Find employee record
      const empRes = await client.query("SELECT id, first_name, last_name FROM employees WHERE email = $1", [session.user.email]);
      const emp = empRes.rows[0];
      if (!emp) {
        throw new Error('Employee profile not found. Please contact an admin.');
      }

      const empName = `${emp.first_name} ${emp.last_name}`;

      // 4. Create regularization
      const sql = `
        INSERT INTO attendance_regularizations 
          (employee_id, employee_name, date, requested_check_in, requested_check_out, reason, status, created_at, updated_at)
        VALUES 
          ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW())
        ON CONFLICT (employee_id, date) DO UPDATE SET
          requested_check_in = EXCLUDED.requested_check_in,
          requested_check_out = EXCLUDED.requested_check_out,
          reason = EXCLUDED.reason,
          status = 'pending',
          updated_at = NOW()
        RETURNING *
      `;

      const res = await client.query(sql, [
        emp.id,
        empName,
        date,
        requested_check_in || null,
        requested_check_out || null,
        reason
      ]);
      return res.rows[0];
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
