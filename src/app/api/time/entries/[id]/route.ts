/**
 * Single time entry.
 *   PATCH  /api/time/entries/[id]   — edit (owner, or HR-or-above)
 *   DELETE /api/time/entries/[id]   — delete (owner, or HR-or-above)
 *
 * Edits are blocked while the entry's timesheet is submitted/approved (locked),
 * unless the actor is HR-or-above.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';
import { isHROrAbove } from '@/lib/leavePermissions';
import {
  resolveBillingRate, computeBillableAmount, recalcTimesheetTotals, isLockedStatus,
} from '@/lib/timeServer';

const EDITABLE = [
  'client_id', 'project_id', 'task_id', 'activity_type', 'description',
  'tags', 'department', 'cost_center', 'is_billable', 'started_at', 'ended_at', 'duration_minutes',
];

async function loadEntry(c: any, id: string) {
  const r = await c.query(
    `SELECT te.*, ts.status AS timesheet_status
     FROM time_entries te LEFT JOIN timesheets ts ON ts.id = te.timesheet_id
     WHERE te.id = $1`,
    [id]
  );
  return r.rows[0];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission(request, 'manage_own_time');
    const { id } = await params;
    const body = await request.json();

    const updated = await withPgClient(async (c) => {
      const entry = await loadEntry(c, id);
      if (!entry) throw new Error('NOT_FOUND');
      const isOwner = entry.employee_email?.toLowerCase() === actor.email.toLowerCase();
      const isHR = isHROrAbove(actor.role);
      if (!isOwner && !isHR) throw new Error('FORBIDDEN');
      if (entry.is_running) throw new Error('Stop the running timer before editing this entry');
      if (isLockedStatus(entry.timesheet_status || '') && !isHR) {
        throw new Error('This entry’s timesheet is locked');
      }

      const next: Record<string, any> = {};
      for (const k of EDITABLE) if (k in body) next[k] = body[k];

      // Recompute duration if start/end changed but duration not explicitly set.
      const startedAt = next.started_at ? new Date(next.started_at) : new Date(entry.started_at);
      const endedAt = ('ended_at' in next)
        ? (next.ended_at ? new Date(next.ended_at) : null)
        : (entry.ended_at ? new Date(entry.ended_at) : null);
      if (next.duration_minutes == null && 'ended_at' in next && endedAt) {
        next.duration_minutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
      }

      const duration = next.duration_minutes != null ? Math.round(Number(next.duration_minutes)) : entry.duration_minutes;
      const isBillable = 'is_billable' in next ? next.is_billable !== false : entry.is_billable;
      const projectId = 'project_id' in next ? next.project_id : entry.project_id;
      const taskId = 'task_id' in next ? next.task_id : entry.task_id;
      const rate = body.billing_rate ?? (await resolveBillingRate(c, projectId, taskId));
      next.billing_rate = rate;
      next.billable_amount = computeBillableAmount(isBillable, duration, rate);

      const sets: string[] = [];
      const vals: any[] = [];
      for (const [k, v] of Object.entries(next)) {
        vals.push(k === 'started_at' || k === 'ended_at' ? (v ? new Date(v as any).toISOString() : null) : v);
        sets.push(`${k} = $${vals.length}`);
      }
      if (sets.length === 0) return entry;
      vals.push(id);
      const res = await c.query(
        `UPDATE time_entries SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      if (entry.timesheet_id) await recalcTimesheetTotals(c, entry.timesheet_id);
      return res.rows[0];
    });
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.message === 'NOT_FOUND') return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    if (err.message === 'FORBIDDEN') return NextResponse.json({ error: 'You can only edit your own entries' }, { status: 403 });
    const status = err.message?.includes('locked') || err.message?.includes('running') ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission(request, 'manage_own_time');
    const { id } = await params;
    await withPgClient(async (c) => {
      const entry = await loadEntry(c, id);
      if (!entry) throw new Error('NOT_FOUND');
      const isOwner = entry.employee_email?.toLowerCase() === actor.email.toLowerCase();
      const isHR = isHROrAbove(actor.role);
      if (!isOwner && !isHR) throw new Error('FORBIDDEN');
      if (isLockedStatus(entry.timesheet_status || '') && !isHR) throw new Error('This entry’s timesheet is locked');
      await c.query(`DELETE FROM time_entries WHERE id = $1`, [id]);
      if (entry.timesheet_id) await recalcTimesheetTotals(c, entry.timesheet_id);
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.message === 'NOT_FOUND') return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    if (err.message === 'FORBIDDEN') return NextResponse.json({ error: 'You can only delete your own entries' }, { status: 403 });
    const status = err.message?.includes('locked') ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
