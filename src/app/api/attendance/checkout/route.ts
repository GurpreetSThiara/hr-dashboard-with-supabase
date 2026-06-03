/**
 * POST /api/attendance/checkout
 *
 * Server-authoritative check-out. Finds the caller's active session (the one
 * with no check_out_time) and stamps check_out_time = NOW() with a
 * server-computed duration. No client-supplied times are trusted, and the
 * "active session" lookup is day-boundary agnostic (fixes the UTC/local bug).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request);

    const data = await withPgClient(async (client) => {
      let empId = actor.employeeId;
      if (!empId) {
        const r = await client.query('SELECT id FROM employees WHERE LOWER(email) = $1', [actor.email]);
        empId = r.rows[0]?.id ?? null;
      }
      if (!empId) throw new Error('No employee record found for your account');

      // The active session is the one without a check-out — regardless of day.
      const activeRes = await client.query(
        `SELECT id FROM checkin_checkout_logs
         WHERE employee_id = $1 AND check_out_time IS NULL
         ORDER BY check_in_time DESC
         LIMIT 1`,
        [empId]
      );
      const active = activeRes.rows[0];
      if (!active) throw new Error('No active check-in record found');

      const res = await client.query(
        `UPDATE checkin_checkout_logs
         SET check_out_time   = NOW(),
             duration_minutes = GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - check_in_time)) / 60))::int
         WHERE id = $1
         RETURNING *`,
        [active.id]
      );
      return res.rows[0];
    });

    return NextResponse.json({ success: true, log: data });
  } catch (err: any) {
    const authResp = authError(err);
    if (authResp) return authResp;
    const status = /No active check-in/i.test(err.message) ? 409 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
