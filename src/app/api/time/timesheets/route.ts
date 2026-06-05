/**
 * Timesheets.
 *   GET  /api/time/timesheets?scope=mine|approvals&status=...   — list
 *   POST /api/time/timesheets   — ensure (create-if-missing) the actor's weekly
 *                                 timesheet for a period; body: { period_start? }
 *
 * scope=mine        → the actor's own timesheets.
 * scope=approvals   → submitted timesheets the actor may approve (their team,
 *                     excluding themselves). Requires approve_time.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';
import { buildTimeVisibilityClause } from '@/lib/timePermissions';
import { ensureWeeklyTimesheet, resolveEmployeeId } from '@/lib/timeServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'mine';
    const status = searchParams.get('status');

    if (scope === 'approvals') {
      const actor = await requirePermission(request, 'approve_time');
      const rows = await withPgClient(async (c) => {
        const conditions: string[] = [`LOWER(ts.employee_email) <> $1`];
        const values: any[] = [actor.email.toLowerCase()];
        const vis = await buildTimeVisibilityClause(actor, values.length, 'ts.employee_email');
        if (vis.clause) { values.push(...vis.params); conditions.push(vis.clause.replace(/^AND /, '')); }
        if (status) { values.push(status); conditions.push(`ts.status = $${values.length}`); }
        else conditions.push(`ts.status = 'submitted'`);
        const r = await c.query(
          `SELECT ts.*, e.first_name, e.last_name
           FROM timesheets ts
           LEFT JOIN employees e ON e.id = ts.employee_id
           WHERE ${conditions.join(' AND ')}
           ORDER BY ts.submitted_at DESC NULLS LAST, ts.period_start DESC`,
          values
        );
        return r.rows;
      });
      return NextResponse.json({ data: rows });
    }

    // scope=mine
    const actor = await requirePermission(request, 'view_time_tracking');
    const rows = await withPgClient(async (c) => {
      const values: any[] = [actor.email.toLowerCase()];
      let where = `WHERE LOWER(employee_email) = $1`;
      if (status) { values.push(status); where += ` AND status = $${values.length}`; }
      const r = await c.query(
        `SELECT * FROM timesheets ${where} ORDER BY period_start DESC`,
        values
      );
      return r.rows;
    });
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(request, 'manage_own_time');
    const body = await request.json().catch(() => ({}));
    const date = body.period_start ? new Date(body.period_start) : new Date();
    const ts = await withPgClient(async (c) => {
      const employeeId = await resolveEmployeeId(c, actor);
      const id = await ensureWeeklyTimesheet(c, actor, employeeId, date);
      const r = await c.query(`SELECT * FROM timesheets WHERE id = $1`, [id]);
      return r.rows[0];
    });
    return NextResponse.json({ data: ts }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
