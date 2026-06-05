/**
 * Global timer engine.
 *   GET   /api/time/timer            — the actor's currently running entry (or null)
 *   POST  /api/time/timer            — start a timer (auto-stops any running one → "switch")
 *   PATCH /api/time/timer            — { action: 'pause'|'resume'|'stop' }
 *
 * Elapsed-time model (mirrors timeTracking.elapsedSeconds):
 *   running & active : acc + (now - paused_at)
 *   running & paused : acc
 *   paused_at marks the start of the current active segment.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError, type AuthedActor } from '@/lib/apiAuth';
import {
  resolveEmployeeId, resolveBillingRate, computeBillableAmount,
  ensureWeeklyTimesheet, recalcTimesheetTotals,
} from '@/lib/timeServer';

const RUNNING_SELECT = `
  SELECT te.*, p.name AS project_name, t.name AS task_name, cl.name AS client_name
  FROM time_entries te
  LEFT JOIN projects p ON p.id = te.project_id
  LEFT JOIN tasks t    ON t.id = te.task_id
  LEFT JOIN clients cl ON cl.id = te.client_id
  WHERE LOWER(te.employee_email) = $1 AND te.is_running = true
  LIMIT 1
`;

async function currentRunning(c: any, email: string) {
  const r = await c.query(RUNNING_SELECT, [email.toLowerCase()]);
  return r.rows[0] || null;
}

/** Finalize a running entry: compute duration, mark stopped, recalc timesheet. */
async function stopEntry(c: any, entry: any, now: Date): Promise<void> {
  const acc = entry.paused_accumulated_seconds || 0;
  const anchor = entry.paused_at ? new Date(entry.paused_at) : new Date(entry.started_at);
  const liveSecs = entry.is_paused ? 0 : Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / 1000));
  const totalSecs = acc + liveSecs;
  const minutes = Math.round(totalSecs / 60);
  const rate = await resolveBillingRate(c, entry.project_id, entry.task_id);
  const amount = computeBillableAmount(entry.is_billable, minutes, rate);
  await c.query(
    `UPDATE time_entries
     SET is_running = false, is_paused = false, ended_at = $2,
         duration_minutes = $3, billing_rate = $4, billable_amount = $5, updated_at = now()
     WHERE id = $1`,
    [entry.id, now.toISOString(), minutes, rate, amount]
  );
  if (entry.timesheet_id) await recalcTimesheetTotals(c, entry.timesheet_id);
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission(request, 'manage_own_time');
    const running = await withPgClient((c) => currentRunning(c, actor.email));
    return NextResponse.json({ data: running });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor: AuthedActor = await requirePermission(request, 'manage_own_time');
    const body = await request.json().catch(() => ({}));
    const now = new Date();

    const created = await withPgClient(async (c) => {
      // Switch semantics: stop any currently running timer first.
      const running = await currentRunning(c, actor.email);
      if (running) await stopEntry(c, running, now);

      const employeeId = await resolveEmployeeId(c, actor);
      const timesheetId = await ensureWeeklyTimesheet(c, actor, employeeId, now);
      const isBillable = body.is_billable !== false;
      const rate = await resolveBillingRate(c, body.project_id || null, body.task_id || null);

      const res = await c.query(
        `INSERT INTO time_entries
           (employee_id, employee_email, client_id, project_id, task_id, timesheet_id,
            activity_type, description, tags, department, cost_center,
            is_billable, billing_rate, source,
            started_at, is_running, is_paused, paused_at, paused_accumulated_seconds, duration_minutes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'timer',$14,true,false,$14,0,0,$2)
         RETURNING *`,
        [
          employeeId, actor.email.toLowerCase(), body.client_id || null, body.project_id || null,
          body.task_id || null, timesheetId, body.activity_type || null, body.description || null,
          Array.isArray(body.tags) ? body.tags : null, body.department || null, body.cost_center || null,
          isBillable, rate, now.toISOString(),
        ]
      );
      return currentRunning(c, actor.email) ?? res.rows[0];
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requirePermission(request, 'manage_own_time');
    const { action } = await request.json();
    const now = new Date();

    const result = await withPgClient(async (c) => {
      const running = await currentRunning(c, actor.email);
      if (!running) throw new Error('NO_TIMER');

      if (action === 'stop') {
        await stopEntry(c, running, now);
        return { stopped: true };
      }
      if (action === 'pause') {
        if (running.is_paused) return currentRunning(c, actor.email);
        const anchor = running.paused_at ? new Date(running.paused_at) : new Date(running.started_at);
        const add = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / 1000));
        await c.query(
          `UPDATE time_entries SET is_paused = true,
             paused_accumulated_seconds = paused_accumulated_seconds + $2, updated_at = now()
           WHERE id = $1`,
          [running.id, add]
        );
        return currentRunning(c, actor.email);
      }
      if (action === 'resume') {
        if (!running.is_paused) return currentRunning(c, actor.email);
        await c.query(
          `UPDATE time_entries SET is_paused = false, paused_at = $2, updated_at = now() WHERE id = $1`,
          [running.id, now.toISOString()]
        );
        return currentRunning(c, actor.email);
      }
      throw new Error('BAD_ACTION');
    });
    return NextResponse.json({ data: result });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.message === 'NO_TIMER') return NextResponse.json({ error: 'No running timer' }, { status: 404 });
    if (err.message === 'BAD_ACTION') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
