/**
 * GET /api/team
 *
 * Returns the current user's team context, reporting-scoped and field-filtered
 * to PUBLIC employee fields only (no salary/compensation):
 *
 *  - me:             the caller's own employee record (public fields)
 *  - directReports:  employees who report directly to the caller
 *  - extendedTeam:   indirect reportees (everyone further down the hierarchy)
 *  - reportingChain: the caller's manager → skip-level → … → top (upward)
 *  - insights:       team size, avg attendance, work anniversaries this month,
 *                    pending leave approvals, pending regularizations, on-leave today
 *
 * Every authenticated employee can call this; non-managers simply get empty
 * report lists but still see their own reporting chain.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';

// Public columns only — field-level security enforced at the query.
const PUB = `id, emp_id, first_name, last_name, email, designation, department,
             employment_type, manager, location, status, join_date, attendance_pct`;

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);

    const data = await withPgClient(async (client) => {
      // Resolve the caller's own employee record by email.
      const meRes = await client.query(
        `SELECT ${PUB} FROM employees WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
        [actor.email]
      );
      const me = meRes.rows[0] || null;
      const myEmail = (me?.email || actor.email).toLowerCase();

      // Direct reports
      const directRes = await client.query(
        `SELECT ${PUB} FROM employees
         WHERE LOWER(manager) = LOWER($1) AND deleted_at IS NULL
         ORDER BY first_name, last_name`,
        [myEmail]
      );
      const directReports = directRes.rows;

      // Full downstream hierarchy with depth (1 = direct, >1 = extended)
      const hierRes = await client.query(
        `
        WITH RECURSIVE hier AS (
          SELECT id, email, manager, 1 AS lvl
          FROM employees WHERE LOWER(manager) = LOWER($1) AND deleted_at IS NULL
          UNION ALL
          SELECT e.id, e.email, e.manager, h.lvl + 1
          FROM employees e
          JOIN hier h ON LOWER(e.manager) = LOWER(h.email)
          WHERE e.deleted_at IS NULL
        )
        SELECT id, lvl FROM hier
        `,
        [myEmail]
      );
      const extendedIds = hierRes.rows.filter((r: any) => r.lvl > 1).map((r: any) => r.id);
      const allTeamIds = hierRes.rows.map((r: any) => r.id);

      let extendedTeam: any[] = [];
      if (extendedIds.length > 0) {
        const extRes = await client.query(
          `SELECT ${PUB} FROM employees WHERE id = ANY($1::uuid[]) ORDER BY department, first_name`,
          [extendedIds]
        );
        extendedTeam = extRes.rows;
      }

      // Upward reporting chain (manager → skip-level → … → top)
      const chainRes = await client.query(
        `
        WITH RECURSIVE chain AS (
          SELECT id, emp_id, first_name, last_name, email, designation, department, manager, 0 AS depth
          FROM employees WHERE LOWER(email) = LOWER($1)
          UNION ALL
          SELECT e.id, e.emp_id, e.first_name, e.last_name, e.email, e.designation, e.department, e.manager, c.depth + 1
          FROM employees e
          JOIN chain c ON LOWER(e.email) = LOWER(c.manager)
          WHERE c.depth < 10
        )
        SELECT id, emp_id, first_name, last_name, email, designation, department, depth
        FROM chain WHERE depth > 0
        ORDER BY depth
        `,
        [myEmail]
      );
      const reportingChain = chainRes.rows.map((r: any) => ({
        ...r,
        relation:
          r.depth === 1 ? 'Reporting Manager' :
          r.depth === 2 ? 'Skip-Level Manager' :
          'Leadership',
      }));

      // ── Insights over the whole team (direct + extended) ──────────────────
      let insights = {
        teamSize: allTeamIds.length,
        directCount: directReports.length,
        avgAttendance: 0,
        onLeaveToday: 0,
        pendingLeaveApprovals: 0,
        pendingRegularizations: 0,
        anniversariesThisMonth: [] as any[],
      };

      if (allTeamIds.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const month = new Date().getMonth() + 1;

        const [att, onLeave, pendLeave, pendReg, annis] = await Promise.all([
          client.query(
            `SELECT COALESCE(AVG(attendance_pct), 0)::numeric(5,1) AS avg FROM employees WHERE id = ANY($1::uuid[])`,
            [allTeamIds]
          ),
          client.query(
            `SELECT COUNT(DISTINCT employee_id)::int AS n FROM leave_requests
             WHERE employee_id = ANY($1::uuid[]) AND status = 'approved'
               AND start_date <= $2 AND end_date >= $2`,
            [allTeamIds, today]
          ),
          client.query(
            `SELECT COUNT(*)::int AS n FROM leave_requests
             WHERE employee_id = ANY($1::uuid[]) AND status = 'pending'`,
            [allTeamIds]
          ),
          client.query(
            `SELECT COUNT(*)::int AS n FROM attendance_regularizations
             WHERE employee_id = ANY($1::uuid[]) AND status = 'pending'`,
            [allTeamIds]
          ),
          client.query(
            `SELECT ${PUB} FROM employees
             WHERE id = ANY($1::uuid[]) AND EXTRACT(MONTH FROM join_date) = $2
             ORDER BY EXTRACT(DAY FROM join_date)`,
            [allTeamIds, month]
          ),
        ]);

        insights = {
          teamSize: allTeamIds.length,
          directCount: directReports.length,
          avgAttendance: Number(att.rows[0].avg),
          onLeaveToday: onLeave.rows[0].n,
          pendingLeaveApprovals: pendLeave.rows[0].n,
          pendingRegularizations: pendReg.rows[0].n,
          anniversariesThisMonth: annis.rows.map((r: any) => ({
            ...r,
            years: new Date().getFullYear() - new Date(r.join_date).getFullYear(),
          })),
        };
      }

      return { me, directReports, extendedTeam, reportingChain, insights };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
