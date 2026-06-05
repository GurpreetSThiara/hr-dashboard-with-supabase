/**
 * GET /api/time/summary — the actor's own roll-up for dashboard widgets:
 * today/week totals (+ billable), this week's overtime, active project count,
 * recent entries, and the current running timer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';
import { startOfWeek, endOfWeek, toDateStr, WEEKLY_OVERTIME_THRESHOLD_MIN } from '@/lib/timeTracking';

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission(request, 'view_time_tracking');
    const email = actor.email.toLowerCase();
    const now = new Date();
    const weekStart = toDateStr(startOfWeek(now));
    const weekEnd = toDateStr(endOfWeek(now));
    const today = toDateStr(now);

    const data = await withPgClient(async (c) => {
      const [todayR, weekR, projR, recentR, runningR] = await Promise.all([
        c.query(
          `SELECT COALESCE(SUM(duration_minutes),0) AS total,
                  COALESCE(SUM(CASE WHEN is_billable THEN duration_minutes ELSE 0 END),0) AS billable
           FROM time_entries
           WHERE LOWER(employee_email) = $1 AND is_running = false AND started_at::date = $2`,
          [email, today]
        ),
        c.query(
          `SELECT COALESCE(SUM(duration_minutes),0) AS total,
                  COALESCE(SUM(CASE WHEN is_billable THEN duration_minutes ELSE 0 END),0) AS billable
           FROM time_entries
           WHERE LOWER(employee_email) = $1 AND is_running = false
             AND started_at::date BETWEEN $2 AND $3`,
          [email, weekStart, weekEnd]
        ),
        c.query(
          `SELECT COUNT(DISTINCT project_id) AS n FROM time_entries
           WHERE LOWER(employee_email) = $1 AND project_id IS NOT NULL
             AND started_at::date BETWEEN $2 AND $3`,
          [email, weekStart, weekEnd]
        ),
        c.query(
          `SELECT te.id, te.description, te.duration_minutes, te.started_at, te.is_billable,
                  p.name AS project_name, t.name AS task_name
           FROM time_entries te
           LEFT JOIN projects p ON p.id = te.project_id
           LEFT JOIN tasks t ON t.id = te.task_id
           WHERE LOWER(te.employee_email) = $1 AND te.is_running = false
           ORDER BY te.started_at DESC LIMIT 5`,
          [email]
        ),
        c.query(
          `SELECT te.*, p.name AS project_name, t.name AS task_name
           FROM time_entries te
           LEFT JOIN projects p ON p.id = te.project_id
           LEFT JOIN tasks t ON t.id = te.task_id
           WHERE LOWER(te.employee_email) = $1 AND te.is_running = true LIMIT 1`,
          [email]
        ),
      ]);

      const weekTotal = parseInt(weekR.rows[0].total);
      return {
        today: { total_minutes: parseInt(todayR.rows[0].total), billable_minutes: parseInt(todayR.rows[0].billable) },
        week: {
          total_minutes: weekTotal,
          billable_minutes: parseInt(weekR.rows[0].billable),
          overtime_minutes: Math.max(0, weekTotal - WEEKLY_OVERTIME_THRESHOLD_MIN),
          period_start: weekStart,
          period_end: weekEnd,
        },
        active_projects: parseInt(projR.rows[0].n),
        recent: recentR.rows,
        running: runningR.rows[0] || null,
      };
    });
    return NextResponse.json(data);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
