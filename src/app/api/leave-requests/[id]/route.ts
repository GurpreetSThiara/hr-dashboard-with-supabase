import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import {
  getActorFromRequest,
  isLeaveOwner,
  isHROrAbove,
  writeAuditLog,
} from '@/lib/leavePermissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const actor = await getActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await withPgClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM leave_requests WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) throw new Error('Leave request not found');
      return res.rows[0];
    });

    // Ownership / visibility check
    const owned = await isLeaveOwner(actor, data.employee_id);
    if (!owned && !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Auth ───────────────────────────────────────────────────────────────
    const actor = await getActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      employee_name, employee_email, leave_type,
      start_date, end_date, reason, days_count, status,
    } = body;

    const data = await withPgClient(async (client) => {
      // Load existing leave
      const existing = await client.query(
        'SELECT * FROM leave_requests WHERE id = $1',
        [id]
      );
      if (existing.rows.length === 0) throw new Error('Leave request not found');
      const leave = existing.rows[0];

      // ── Permission check ───────────────────────────────────────────────
      const owned = await isLeaveOwner(actor, leave.employee_id);

      if (!owned && !isHROrAbove(actor.role)) {
        throw new Error('You do not have permission to edit this leave request');
      }

      // Employees can only edit their own PENDING leaves
      if (owned && !isHROrAbove(actor.role) && leave.status !== 'pending') {
        throw new Error('You can only edit pending leave requests');
      }

      // HR cannot change status via PUT (use the approve endpoint)
      if (status && !isHROrAbove(actor.role)) {
        throw new Error('You cannot change leave status directly');
      }

      const res = await client.query(
        `UPDATE leave_requests
         SET employee_name  = COALESCE($1, employee_name),
             employee_email = COALESCE($2, employee_email),
             leave_type     = COALESCE($3, leave_type),
             start_date     = COALESCE($4, start_date),
             end_date       = COALESCE($5, end_date),
             reason         = COALESCE($6, reason),
             days_count     = COALESCE($7, days_count),
             updated_at     = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          employee_name || null,
          employee_email || null,
          leave_type    || null,
          start_date    || null,
          end_date      || null,
          reason        || null,
          days_count    || null,
          id,
        ]
      );

      const updated = res.rows[0];
      writeAuditLog(actor, 'updated', id, leave, updated);
      return updated;
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const status =
      error.message.includes('permission') || error.message.includes('cannot change')
        ? 403
        : error.message.includes('not found')
        ? 404
        : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Auth ───────────────────────────────────────────────────────────────
    const actor = await getActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await withPgClient(async (client) => {
      const existing = await client.query(
        'SELECT * FROM leave_requests WHERE id = $1',
        [id]
      );
      if (existing.rows.length === 0) throw new Error('Leave request not found');
      const leave = existing.rows[0];

      const owned = await isLeaveOwner(actor, leave.employee_id);

      // Employees can delete only their own PENDING leaves
      if (owned && !isHROrAbove(actor.role)) {
        if (leave.status !== 'pending') {
          throw new Error('You can only delete pending leave requests');
        }
      } else if (!owned && !isHROrAbove(actor.role)) {
        throw new Error('You do not have permission to delete this leave request');
      }

      await client.query('DELETE FROM leave_requests WHERE id = $1', [id]);
      writeAuditLog(actor, 'deleted', id, leave, null);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status =
      error.message.includes('permission') || error.message.includes('only delete')
        ? 403
        : error.message.includes('not found')
        ? 404
        : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
