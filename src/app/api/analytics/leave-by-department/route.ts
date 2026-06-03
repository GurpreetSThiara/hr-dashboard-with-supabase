/**
 * GET /api/analytics/leave-by-department
 * Real leave aggregates grouped by department for the current year.
 * Requires view_hr_dashboard (tier ≤ 11).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireMaxTier, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireMaxTier(request, 11);

    const data = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT
          COALESCE(department, 'Unassigned') AS dept,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
        FROM leave_requests
        WHERE EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        GROUP BY COALESCE(department, 'Unassigned')
        ORDER BY (COUNT(*)) DESC
      `);
      return res.rows;
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    const authResp = authError(err);
    if (authResp) return authResp;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
