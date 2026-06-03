import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase, getServerUser } from '@/lib/supabase/server';
import { differenceInMinutes, parseISO } from 'date-fns';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing regularization ID' }, { status: 400 });
    }

    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json({ error: 'Supabase connection not configured' }, { status: 503 });
    }

    // Authenticate user
    const user = await getServerUser(request, conn.client);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify manager/HR permission
    const profileRes = await conn.client
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profileRes?.data?.role || 'Employee';
    const allowedRoles = ['Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager'];
    
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden: Manager access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, approver_notes } = body as { action: 'approved' | 'rejected'; approver_notes?: string };

    if (!action || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be approved or rejected.' }, { status: 400 });
    }

    const result = await withPgClient(async (client) => {
      // 1. Get regularization request
      const regRes = await client.query("SELECT * FROM attendance_regularizations WHERE id = $1", [id]);
      const reg = regRes.rows[0];
      if (!reg) {
        throw new Error('Regularization request not found');
      }

      if (reg.status !== 'pending') {
        throw new Error(`Regularization request has already been ${reg.status}.`);
      }

      // 2. Perform updates based on action
      if (action === 'rejected') {
        const updateRes = await client.query(
          `UPDATE attendance_regularizations
           SET status = 'rejected', approver_notes = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [approver_notes || null, id]
        );
        return updateRes.rows[0];
      }

      // Action is 'approved'
      // 2a. Update regularization request status
      const updateRes = await client.query(
        `UPDATE attendance_regularizations
         SET status = 'approved', approver_notes = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [approver_notes || null, id]
      );

      // 2b. Compute duration minutes
      let durationMinutes = null;
      if (reg.requested_check_in && reg.requested_check_out) {
        const start = typeof reg.requested_check_in === 'string' ? parseISO(reg.requested_check_in) : new Date(reg.requested_check_in);
        const end = typeof reg.requested_check_out === 'string' ? parseISO(reg.requested_check_out) : new Date(reg.requested_check_out);
        durationMinutes = Math.max(1, differenceInMinutes(end, start));
      }

      // 2c. Upsert checkin_checkout_logs for that employee and date
      const dateStr = reg.date instanceof Date ? reg.date.toISOString().split('T')[0] : String(reg.date).split('T')[0];
      
      // Look if log exists for that day (check_in_time is within that date range)
      const startOfDay = `${dateStr}T00:00:00.000Z`;
      const endOfDay = `${dateStr}T23:59:59.999Z`;
      
      const logRes = await client.query(
        `SELECT id FROM checkin_checkout_logs 
         WHERE employee_id = $1 
           AND check_in_time >= $2 
           AND check_in_time <= $3 
         LIMIT 1`,
        [reg.employee_id, startOfDay, endOfDay]
      );

      const log = logRes.rows[0];
      if (log) {
        // Update existing log
        await client.query(
          `UPDATE checkin_checkout_logs 
           SET check_in_time = $1, 
               check_out_time = $2, 
               duration_minutes = $3,
               notes = $4
           WHERE id = $5`,
          [reg.requested_check_in, reg.requested_check_out, durationMinutes, `Regularized: ${reg.reason}`, log.id]
        );
      } else {
        // Insert new log
        await client.query(
          `INSERT INTO checkin_checkout_logs 
            (employee_id, check_in_time, check_out_time, duration_minutes, location, device, notes, created_at)
           VALUES 
            ($1, $2, $3, $4, 'Office', 'System', $5, NOW())`,
          [reg.employee_id, reg.requested_check_in, reg.requested_check_out, durationMinutes, `Regularized: ${reg.reason}`]
        );
      }

      // 2d. Upsert attendance_records
      const attRes = await client.query(
        `SELECT id FROM attendance_records 
         WHERE employee_id = $1 AND attendance_date = $2 
         LIMIT 1`,
        [reg.employee_id, dateStr]
      );

      const att = attRes.rows[0];
      if (att) {
        // Update status to present
        await client.query(
          `UPDATE attendance_records SET status = 'present' WHERE id = $1`,
          [att.id]
        );
      } else {
        // Insert new present record
        await client.query(
          `INSERT INTO attendance_records (employee_id, attendance_date, status, created_at)
           VALUES ($1, $2, 'present', NOW())`,
          [reg.employee_id, dateStr]
        );
      }

      return updateRes.rows[0];
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
