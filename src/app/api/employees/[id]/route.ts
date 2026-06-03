import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireAuth, requireManageEmployees, authError } from '@/lib/apiAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: viewing a single employee requires authentication.
    const actor = await requireAuth(request);
    const isHrViewer = actor.tier <= 6;

    const { id } = await params;
    const data = await withPgClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM employees WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) throw new Error('Employee not found');
      return res.rows[0];
    });

    // Strip compensation data from non-HR viewers
    if (!isHrViewer && data) delete (data as any).salary_band;

    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: editing employees requires manage_employees (tier ≤ 7).
    const actor = await requireManageEmployees(request);
    const userEmail = actor.email;

    const { id } = await params;
    const body = await request.json();

    const data = await withPgClient(async (client) => {
      // Whitelist of columns that actually exist on the employees table.
      const allowed = [
        'first_name', 'last_name', 'email', 'department', 'designation',
        'employment_type', 'manager', 'join_date', 'status',
        'salary_band', 'location', 'attendance_pct',
      ];
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in body) {
          updates.push(`${key} = $${idx++}`);
          values.push(body[key]);
        }
      }
      if (updates.length === 0) throw new Error('No valid fields to update');
      updates.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE employees SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (res.rows.length === 0) throw new Error('Employee not found');
      return res.rows[0];
    });

    // Log activity fire-and-forget
    const conn = getServerSupabase();
    if (conn) {
      void Promise.resolve(
        conn.client.from('activity_feed').insert([{
          user_email: userEmail,
          action: 'updated_employee',
          description: `Updated employee: ${data.first_name} ${data.last_name}`,
          target_id: data.id,
          target_type: 'employee',
        }])
      ).catch(() => {});
    }

    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: deleting employees requires manage_employees (tier ≤ 7).
    const actor = await requireManageEmployees(request);
    const userEmail = actor.email;

    const { id } = await params;

    // SOFT DELETE: preserve HR history (leave, attendance) — never hard-delete.
    // The employees→children FKs are ON DELETE RESTRICT, so a hard delete would
    // also fail for anyone with history. We mark the record terminated instead.
    const employee = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE employees SET status = 'terminated', updated_at = NOW()
         WHERE id = $1
         RETURNING first_name, last_name`,
        [id]
      );
      if (res.rows.length === 0) throw new Error('Employee not found');
      return res.rows[0];
    });

    // Log activity fire-and-forget
    const conn = getServerSupabase();
    if (conn) {
      void Promise.resolve(
        conn.client.from('activity_feed').insert([{
          user_email: userEmail,
          action: 'deactivated_employee',
          description: `Deactivated employee: ${employee.first_name} ${employee.last_name}`,
          target_id: id,
          target_type: 'employee',
        }])
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, softDeleted: true });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
