/**
 * Single timesheet + approval workflow.
 *   GET   /api/time/timesheets/[id]   — detail + its entries (owner or approver)
 *   PATCH /api/time/timesheets/[id]   — { action: submit|approve|reject|return, comment? }
 *
 * Transitions:
 *   submit  : owner only, from draft/returned → submitted
 *   approve : approver (not owner), from submitted → approved
 *   reject  : approver, from submitted → rejected
 *   return  : approver, from submitted → returned (re-editable by owner)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';
import { canApproveTimeFor } from '@/lib/timePermissions';
import { recalcTimesheetTotals } from '@/lib/timeServer';

async function loadTimesheet(c: any, id: string) {
  const r = await c.query(`SELECT * FROM timesheets WHERE id = $1`, [id]);
  return r.rows[0];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission(request, 'view_time_tracking');
    const { id } = await params;
    const result = await withPgClient(async (c) => {
      const ts = await loadTimesheet(c, id);
      if (!ts) throw new Error('NOT_FOUND');
      const isOwner = ts.employee_email?.toLowerCase() === actor.email.toLowerCase();
      if (!isOwner && !(await canApproveTimeFor(actor, ts.employee_email))) throw new Error('FORBIDDEN');
      const entries = await c.query(
        `SELECT te.*, p.name AS project_name, t.name AS task_name, cl.name AS client_name
         FROM time_entries te
         LEFT JOIN projects p ON p.id = te.project_id
         LEFT JOIN tasks t    ON t.id = te.task_id
         LEFT JOIN clients cl ON cl.id = te.client_id
         WHERE te.timesheet_id = $1 AND te.is_running = false
         ORDER BY te.started_at ASC`,
        [id]
      );
      return { timesheet: ts, entries: entries.rows };
    });
    return NextResponse.json(result);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.message === 'NOT_FOUND') return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    if (err.message === 'FORBIDDEN') return NextResponse.json({ error: 'Not permitted' }, { status: 403 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { action, comment } = await request.json();
    const { id } = await params;

    // submit is an owner action (manage_own_time); approve/reject/return need approve_time.
    const permission = action === 'submit' ? 'manage_own_time' : 'approve_time';
    const actor = await requirePermission(request, permission);

    const result = await withPgClient(async (c) => {
      const ts = await loadTimesheet(c, id);
      if (!ts) throw new Error('NOT_FOUND');
      const isOwner = ts.employee_email?.toLowerCase() === actor.email.toLowerCase();

      if (action === 'submit') {
        if (!isOwner) throw new Error('FORBIDDEN');
        if (!['draft', 'returned', 'rejected'].includes(ts.status)) {
          throw new Error(`Cannot submit a timesheet in "${ts.status}" state`);
        }
        await recalcTimesheetTotals(c, id);
        const r = await c.query(
          `UPDATE timesheets SET status = 'submitted', submitted_at = now(),
             approved_by = NULL, approved_at = NULL, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [id]
        );
        return r.rows[0];
      }

      // Approval-side actions.
      if (!(await canApproveTimeFor(actor, ts.employee_email))) throw new Error('FORBIDDEN');
      if (ts.status !== 'submitted') throw new Error(`Cannot ${action} a timesheet in "${ts.status}" state`);
      const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'return' ? 'returned' : null;
      if (!nextStatus) throw new Error('BAD_ACTION');

      const r = await c.query(
        `UPDATE timesheets SET status = $2, approved_by = $3, approved_at = now(),
           reviewer_comment = $4, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id, nextStatus, actor.email, comment || null]
      );
      return r.rows[0];
    });
    return NextResponse.json({ data: result });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.message === 'NOT_FOUND') return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    if (err.message === 'FORBIDDEN') return NextResponse.json({ error: 'Not permitted for this timesheet' }, { status: 403 });
    if (err.message === 'BAD_ACTION') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    const status = err.message?.includes('Cannot') ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
