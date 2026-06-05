/**
 * Shared server-side helpers for Time Tracking API routes (DB-touching).
 * Keep route handlers thin by centralizing billing-rate resolution, timesheet
 * total recomputation, and per-date timesheet linkage here.
 */
import type { AuthedActor } from '@/lib/apiAuth';
import { startOfWeek, endOfWeek, toDateStr } from '@/lib/timeTracking';

/** Resolve the actor's employee id (may be null if no employee profile). */
export async function resolveEmployeeId(client: any, actor: AuthedActor): Promise<string | null> {
  if (actor.employeeId) return actor.employeeId;
  const r = await client.query(
    `SELECT id FROM employees WHERE LOWER(email) = $1 LIMIT 1`,
    [actor.email.toLowerCase()]
  );
  return r.rows[0]?.id ?? null;
}

/**
 * Resolve the applicable hourly billing rate for an entry, preferring the most
 * specific scope: task → project. Returns null when none configured.
 */
export async function resolveBillingRate(
  client: any,
  projectId: string | null,
  taskId: string | null
): Promise<number | null> {
  if (taskId) {
    const t = await client.query(`SELECT billing_rate FROM tasks WHERE id = $1`, [taskId]);
    const r = t.rows[0]?.billing_rate;
    if (r != null) return Number(r);
  }
  if (projectId) {
    const p = await client.query(`SELECT billing_rate FROM projects WHERE id = $1`, [projectId]);
    const r = p.rows[0]?.billing_rate;
    if (r != null) return Number(r);
  }
  return null;
}

/** Compute billable amount from duration + rate (0 when non-billable). */
export function computeBillableAmount(
  isBillable: boolean,
  durationMinutes: number,
  rate: number | null
): number | null {
  if (!isBillable || rate == null) return isBillable ? null : 0;
  return Math.round((durationMinutes / 60) * rate * 100) / 100;
}

/**
 * Ensure a weekly (draft) timesheet exists for the actor covering `date`, and
 * return its id. Created lazily so entries always have a home.
 */
export async function ensureWeeklyTimesheet(
  client: any,
  actor: AuthedActor,
  employeeId: string | null,
  date: Date
): Promise<string> {
  const periodStart = toDateStr(startOfWeek(date));
  const periodEnd = toDateStr(endOfWeek(date));

  const existing = await client.query(
    `SELECT id FROM timesheets
     WHERE LOWER(employee_email) = $1 AND period_type = 'weekly' AND period_start = $2
     LIMIT 1`,
    [actor.email.toLowerCase(), periodStart]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const ins = await client.query(
    `INSERT INTO timesheets (employee_id, employee_email, period_type, period_start, period_end, status)
     VALUES ($1, $2, 'weekly', $3, $4, 'draft')
     ON CONFLICT (employee_id, period_type, period_start) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [employeeId, actor.email.toLowerCase(), periodStart, periodEnd]
  );
  return ins.rows[0].id;
}

/** Recompute and persist a timesheet's total / billable minutes from its entries. */
export async function recalcTimesheetTotals(client: any, timesheetId: string): Promise<void> {
  await client.query(
    `UPDATE timesheets t SET
       total_minutes = COALESCE(s.total, 0),
       billable_minutes = COALESCE(s.billable, 0),
       updated_at = now()
     FROM (
       SELECT
         COALESCE(SUM(duration_minutes), 0) AS total,
         COALESCE(SUM(CASE WHEN is_billable THEN duration_minutes ELSE 0 END), 0) AS billable
       FROM time_entries WHERE timesheet_id = $1 AND is_running = false
     ) s
     WHERE t.id = $1`,
    [timesheetId]
  );
}

/** Whether a timesheet is locked (submitted/approved) — entries shouldn't change. */
export function isLockedStatus(status: string): boolean {
  return status === 'submitted' || status === 'approved';
}
