import { NextRequest, NextResponse } from 'next/server';
import { withTenantPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';
import { ENTITIES } from '@/lib/workspaceEntities';

/**
 * GET /api/me/hr-stats — per-entity record counts (for the Workspace overview &
 * nav badges) plus derived HR metrics for dashboard widgets. Org-scoped.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    if (!actor.organizationId) {
      return NextResponse.json({ counts: {}, derived: {} });
    }
    const data = await withTenantPgClient(actor.organizationId, async (client) => {
      const org = actor.organizationId;

      // Per-entity counts (tables come from our own registry — safe to interpolate).
      const counts: Record<string, number> = {};
      await Promise.all(Object.entries(ENTITIES).map(async ([key, cfg]) => {
        try {
          const r = await client.query(`SELECT count(*)::int n FROM ${cfg.table} WHERE organization_id = $1`, [org]);
          counts[key] = r.rows[0].n;
        } catch { counts[key] = 0; }
      }));

      const safe = async (sql: string) => { try { return (await client.query(sql, [org])).rows; } catch { return []; } };

      const openPositions = (await safe(`SELECT COALESCE(SUM(openings),0)::int n FROM job_openings WHERE organization_id=$1 AND status='open'`))[0]?.n ?? 0;
      const pending = await safe(`
        SELECT
          (SELECT count(*) FROM expense_claims  WHERE organization_id=$1 AND status='pending')::int AS expenses,
          (SELECT count(*) FROM hr_tickets      WHERE organization_id=$1 AND status='open')::int    AS tickets,
          (SELECT count(*) FROM travel_requests WHERE organization_id=$1 AND status='pending')::int AS travel,
          (SELECT count(*) FROM advance_requests WHERE organization_id=$1 AND status='pending')::int AS advances`);
      const p = pending[0] ?? {};
      const pendingApprovals = (p.expenses ?? 0) + (p.tickets ?? 0) + (p.travel ?? 0) + (p.advances ?? 0);

      const newHires = (await safe(`SELECT count(*)::int n FROM employees WHERE organization_id=$1 AND date_trunc('month', join_date) = date_trunc('month', CURRENT_DATE)`))[0]?.n ?? 0;
      const headcountByDept = await safe(`SELECT department, count(*)::int n FROM employees WHERE organization_id=$1 AND status='active' GROUP BY department ORDER BY n DESC LIMIT 8`);
      const upcomingInterviews = (await safe(`SELECT count(*)::int n FROM interviews WHERE organization_id=$1 AND status='scheduled' AND scheduled_at >= NOW()`))[0]?.n ?? 0;
      const openGrievances = (await safe(`SELECT count(*)::int n FROM grievances WHERE organization_id=$1 AND status <> 'resolved'`))[0]?.n ?? 0;

      return {
        counts,
        derived: { openPositions, pendingApprovals, pendingBreakdown: p, newHires, headcountByDept, upcomingInterviews, openGrievances },
      };
    });
    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
