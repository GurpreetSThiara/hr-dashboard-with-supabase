/**
 * POST /api/attendance/checkin
 *
 * Server-authoritative check-in. The check-in timestamp is stamped by the DB
 * (NOW()), never supplied by the client — this prevents attendance spoofing.
 * Also enforces the attendance settings (feature toggle + allowed tiers) on the
 * server, not just in the UI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const location = body?.location === 'Home' ? 'Home' : 'Office';
    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 500) : null;
    const device = body?.device === 'Mobile' ? 'Mobile' : 'Desktop';

    const data = await withPgClient(async (client) => {
      // Resolve the actor's employee record (never trust a client-supplied id)
      let empId = actor.employeeId;
      if (!empId) {
        const r = await client.query('SELECT id FROM employees WHERE LOWER(email) = $1', [actor.email]);
        empId = r.rows[0]?.id ?? null;
      }
      if (!empId) throw new Error('No employee record found for your account');

      // Enforce attendance settings server-side
      const settingsRes = await client.query(
        "SELECT enable_checkin_checkout, checkin_checkout_allowed_tiers FROM attendance_settings WHERE id = 'default' LIMIT 1"
      );
      const settings = settingsRes.rows[0];
      if (settings) {
        if (settings.enable_checkin_checkout === false) {
          throw new Error('Check-in/check-out is currently disabled by your administrator');
        }
        const tiers: number[] | null = settings.checkin_checkout_allowed_tiers;
        if (Array.isArray(tiers) && tiers.length > 0 && !tiers.includes(actor.tier)) {
          throw new Error('Your role is not permitted to check in');
        }
      }

      // Prevent a second concurrent active session
      const active = await client.query(
        'SELECT id FROM checkin_checkout_logs WHERE employee_id = $1 AND check_out_time IS NULL LIMIT 1',
        [empId]
      );
      if (active.rows.length > 0) {
        throw new Error('You already have an active check-in. Please check out first.');
      }

      const res = await client.query(
        `INSERT INTO checkin_checkout_logs
           (employee_id, check_in_time, location, device, notes, created_at)
         VALUES ($1, NOW(), $2, $3, $4, NOW())
         RETURNING *`,
        [empId, location, device, notes]
      );
      return res.rows[0];
    });

    return NextResponse.json({ success: true, log: data }, { status: 201 });
  } catch (err: any) {
    const authResp = authError(err);
    if (authResp) return authResp;
    const status = /disabled|not permitted|active check-in/i.test(err.message) ? 409 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
