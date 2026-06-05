/**
 * Time entries.
 *   GET  /api/time/entries   — list (visibility-scoped; filters: scope, project_id, from, to)
 *   POST /api/time/entries   — create a manual (completed) entry
 *
 * Visibility: HR-or-above see all; everyone else sees own + downstream reports
 * (see timePermissions). `scope=mine` narrows to the actor regardless of role.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';
import { buildTimeVisibilityClause } from '@/lib/timePermissions';
import {
  resolveEmployeeId, resolveBillingRate, computeBillableAmount,
  ensureWeeklyTimesheet, recalcTimesheetTotals, isLockedStatus,
} from '@/lib/timeServer';

const SELECT_COLS = `
  te.*, p.name AS project_name, t.name AS task_name, cl.name AS client_name
`;
const JOINS = `
  LEFT JOIN projects p ON p.id = te.project_id
  LEFT JOIN tasks t    ON t.id = te.task_id
  LEFT JOIN clients cl ON cl.id = te.client_id
`;

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission(request, 'view_time_tracking');
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const projectId = searchParams.get('project_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '100'));
    const offset = (page - 1) * limit;

    const result = await withPgClient(async (c) => {
      const conditions: string[] = ['te.is_running = false'];
      const values: any[] = [];

      if (scope === 'mine') {
        values.push(actor.email.toLowerCase());
        conditions.push(`LOWER(te.employee_email) = $${values.length}`);
      } else {
        const vis = await buildTimeVisibilityClause(actor, values.length, 'te.employee_email');
        if (vis.clause) {
          values.push(...vis.params);
          conditions.push(vis.clause.replace(/^AND /, ''));
        }
      }
      if (projectId) { values.push(projectId); conditions.push(`te.project_id = $${values.length}`); }
      if (from) { values.push(from); conditions.push(`te.started_at >= $${values.length}`); }
      if (to) { values.push(to); conditions.push(`te.started_at <= $${values.length}`); }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const [count, rows] = await Promise.all([
        c.query(`SELECT COUNT(*) FROM time_entries te ${where}`, values),
        c.query(
          `SELECT ${SELECT_COLS} FROM time_entries te ${JOINS} ${where}
           ORDER BY te.started_at DESC LIMIT ${limit} OFFSET ${offset}`,
          values
        ),
      ]);
      return {
        data: rows.rows,
        pagination: {
          page, limit,
          total: parseInt(count.rows[0].count),
          pages: Math.ceil(parseInt(count.rows[0].count) / limit),
        },
      };
    });
    return NextResponse.json(result);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(request, 'manage_own_time');
    const body = await request.json();

    const startedAt = body.started_at ? new Date(body.started_at) : null;
    const endedAt = body.ended_at ? new Date(body.ended_at) : null;
    let duration = body.duration_minutes != null ? Math.round(Number(body.duration_minutes)) : null;
    if (duration == null && startedAt && endedAt) {
      duration = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
    }
    if (duration == null || duration < 0 || !startedAt) {
      return NextResponse.json(
        { error: 'A start time and a positive duration (or end time) are required' },
        { status: 400 }
      );
    }
    const isBillable = body.is_billable !== false;

    const created = await withPgClient(async (c) => {
      const employeeId = await resolveEmployeeId(c, actor);
      const rate = body.billing_rate ?? (await resolveBillingRate(c, body.project_id || null, body.task_id || null));
      const amount = computeBillableAmount(isBillable, duration!, rate);

      const timesheetId = await ensureWeeklyTimesheet(c, actor, employeeId, startedAt);
      // Don't attach to a locked timesheet.
      const ts = await c.query(`SELECT status FROM timesheets WHERE id = $1`, [timesheetId]);
      if (ts.rows[0] && isLockedStatus(ts.rows[0].status)) {
        throw new Error('This period’s timesheet has already been submitted and is locked');
      }

      const res = await c.query(
        `INSERT INTO time_entries
           (employee_id, employee_email, client_id, project_id, task_id, timesheet_id,
            activity_type, description, tags, department, cost_center,
            is_billable, billing_rate, billable_amount, source,
            started_at, ended_at, duration_minutes, is_running, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual',$15,$16,$17,false,$2)
         RETURNING *`,
        [
          employeeId, actor.email.toLowerCase(), body.client_id || null, body.project_id || null,
          body.task_id || null, timesheetId, body.activity_type || null, body.description || null,
          Array.isArray(body.tags) ? body.tags : null, body.department || null, body.cost_center || null,
          isBillable, rate, amount,
          startedAt.toISOString(), endedAt ? endedAt.toISOString() : null, duration,
        ]
      );
      await recalcTimesheetTotals(c, timesheetId);
      return res.rows[0];
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    const status = err.message?.includes('locked') ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
