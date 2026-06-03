/**
 * GET /api/leave-balance
 *
 * Returns the authenticated employee's leave balance per type for the
 * current year.  Uses `leave_balance_view` (DB view) for approved usage
 * and adds pending days from a second pass.
 *
 * Optional query param: ?year=YYYY (defaults to current year)
 * Optional query param: ?employee_id=UUID (HR+ only — query another employee)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

export interface LeaveBalanceEntry {
  leave_type: string;
  days_per_year: number;
  days_used: number;
  days_pending: number;
  days_remaining: number;
  color?: string;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year       = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const queryEmpId = searchParams.get('employee_id');

    // Only HR+ can query another employee's balance
    if (queryEmpId && !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await withPgClient(async (client) => {
      // Resolve which employee to report on
      let employeeId = queryEmpId;
      if (!employeeId) {
        if (actor.employeeId) {
          employeeId = actor.employeeId;
        } else {
          const r = await client.query(
            `SELECT id FROM employees WHERE LOWER(email) = $1 LIMIT 1`,
            [actor.email]
          );
          employeeId = r.rows[0]?.id ?? null;
        }
      }

      if (!employeeId) {
        return { employee_id: null, year, balances: [] };
      }

      // ── Approved usage from leave_balance_view ──────────────────────────
      // The view already filters to CURRENT_DATE year, so we re-compute for
      // the requested year via a direct query that mirrors the view logic.
      const balRes = await client.query(`
        SELECT
          lt.name                                              AS leave_type,
          lt.color,
          COALESCE(lpr.days_per_year, lp.days_per_year, 0)   AS days_per_year,
          COALESCE(
            SUM(CASE WHEN lr.status = 'approved'
                      AND EXTRACT(YEAR FROM lr.start_date) = $2
                 THEN lr.days_count ELSE 0 END), 0
          )::int                                               AS days_used
        FROM leave_types lt
        -- prefer active policy version's rules
        LEFT JOIN (
          SELECT r.leave_type_id, r.days_per_year
          FROM   leave_policy_rules r
          JOIN   leave_policy_versions v ON v.id = r.version_id AND v.is_active = true
        ) lpr ON lpr.leave_type_id = lt.id
        LEFT JOIN leave_policies lp ON lp.leave_type_id = lt.id
        LEFT JOIN leave_requests lr ON lr.employee_id = $1 AND lr.leave_type = lt.name
        GROUP BY lt.name, lt.color, lpr.days_per_year, lp.days_per_year
        ORDER BY lt.name
      `, [employeeId, year]);

      // ── Pending days ────────────────────────────────────────────────────
      const pendRes = await client.query(`
        SELECT leave_type, SUM(days_count)::int AS pending_days
        FROM   leave_requests
        WHERE  employee_id = $1
          AND  status = 'pending'
          AND  EXTRACT(YEAR FROM start_date) = $2
        GROUP BY leave_type
      `, [employeeId, year]);

      const pendingMap: Record<string, number> = {};
      pendRes.rows.forEach((r: any) => { pendingMap[r.leave_type] = r.pending_days; });

      const balances: LeaveBalanceEntry[] = balRes.rows
        .filter((r: any) => r.days_per_year > 0)
        .map((r: any) => {
          const used    = r.days_used;
          const pending = pendingMap[r.leave_type] ?? 0;
          return {
            leave_type:    r.leave_type,
            days_per_year: r.days_per_year,
            days_used:     used,
            days_pending:  pending,
            days_remaining: Math.max(0, r.days_per_year - used),
            color:          r.color ?? undefined,
          };
        });

      return { employee_id: employeeId, year, balances };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
