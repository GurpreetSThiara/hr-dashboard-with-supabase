/**
 * GET /api/analytics/headcount-trend?weeks=12
 *
 * Real cumulative headcount derived from employees.join_date — for each week
 * boundary it counts active employees who had joined by then. (Terminations are
 * not date-tracked in this schema, so this reflects cumulative active hires.)
 * Requires view_hr_dashboard (tier ≤ 11).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireMaxTier, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireMaxTier(request, 11);

    const weeks = Math.min(52, Math.max(4, parseInt(request.nextUrl.searchParams.get('weeks') || '12')));

    const data = await withPgClient(async (client) => {
      // Pull join dates of active employees once, bucket in JS.
      const res = await client.query(
        `SELECT join_date FROM employees WHERE status = 'active' AND join_date IS NOT NULL`
      );
      const joinDates = res.rows
        .map((r: any) => new Date(r.join_date))
        .filter((d: Date) => !isNaN(d.getTime()));

      const points: { week: string; headcount: number; joiners: number }[] = [];
      const now = new Date();
      // Week boundaries: end of each of the last `weeks` weeks (most recent last)
      let prevCount = 0;
      for (let i = weeks - 1; i >= 0; i--) {
        const boundary = new Date(now);
        boundary.setDate(boundary.getDate() - i * 7);
        const headcount = joinDates.filter((d: Date) => d <= boundary).length;
        const label = boundary.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        points.push({ week: label, headcount, joiners: Math.max(0, headcount - prevCount) });
        prevCount = headcount;
      }

      const netChange = points.length > 0 ? points[points.length - 1].headcount - points[0].headcount : 0;
      return { points, netChange };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    const authResp = authError(err);
    if (authResp) return authResp;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
