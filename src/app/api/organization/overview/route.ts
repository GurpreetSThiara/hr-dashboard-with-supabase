/**
 * GET /api/organization/overview
 *
 * Company-wide organizational metrics from REAL system data (no mock values).
 * Requires authentication. Headcount aggregates are non-sensitive.
 *
 * Returns:
 *  - totalHeadcount, activeEmployees, terminated
 *  - newHires30 / newHires90 (by join_date)
 *  - attritionRatePct (terminated / (active + terminated), coarse — see note)
 *  - departmentDistribution[], locationDistribution[], employmentTypeDistribution[]
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const data = await withPgClient(async (client) => {
      const [counts, depts, locs, types] = await Promise.all([
        client.query(`
          SELECT
            COUNT(*) FILTER (WHERE deleted_at IS NULL)::int                          AS total,
            COUNT(*) FILTER (WHERE status = 'active' AND deleted_at IS NULL)::int     AS active,
            COUNT(*) FILTER (WHERE status = 'terminated' OR deleted_at IS NOT NULL)::int AS terminated,
            COUNT(*) FILTER (WHERE join_date >= CURRENT_DATE - INTERVAL '30 days')::int AS new30,
            COUNT(*) FILTER (WHERE join_date >= CURRENT_DATE - INTERVAL '90 days')::int AS new90
          FROM employees
        `),
        client.query(`
          SELECT COALESCE(department,'Unassigned') AS name, COUNT(*)::int AS value
          FROM employees WHERE deleted_at IS NULL AND status = 'active'
          GROUP BY COALESCE(department,'Unassigned') ORDER BY value DESC
        `),
        client.query(`
          SELECT COALESCE(location,'Unassigned') AS name, COUNT(*)::int AS value
          FROM employees WHERE deleted_at IS NULL AND status = 'active'
          GROUP BY COALESCE(location,'Unassigned') ORDER BY value DESC
        `),
        client.query(`
          SELECT COALESCE(employment_type,'Unspecified') AS name, COUNT(*)::int AS value
          FROM employees WHERE deleted_at IS NULL AND status = 'active'
          GROUP BY COALESCE(employment_type,'Unspecified') ORDER BY value DESC
        `),
      ]);

      const c = counts.rows[0];
      const denom = c.active + c.terminated;
      const attritionRatePct = denom > 0 ? Math.round((c.terminated / denom) * 1000) / 10 : 0;

      return {
        totalHeadcount: c.total,
        activeEmployees: c.active,
        terminated: c.terminated,
        newHires30: c.new30,
        newHires90: c.new90,
        attritionRatePct,
        departmentDistribution: depts.rows,
        locationDistribution: locs.rows,
        employmentTypeDistribution: types.rows,
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
