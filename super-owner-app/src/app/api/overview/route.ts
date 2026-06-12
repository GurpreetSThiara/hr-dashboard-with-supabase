import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';

/** GET /api/overview — platform-wide metrics for the dashboard. */
export async function GET(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const data = await withPgClient(async (client) => {
      const [orgs, statuses, users, subs, planDist, modules, recent, growth, mrr] = await Promise.all([
        client.query(`SELECT count(*)::int n FROM organizations`),
        client.query(`SELECT status, count(*)::int n FROM organizations GROUP BY status`),
        client.query(`SELECT
            count(*) FILTER (WHERE organization_id IS NOT NULL)::int AS tenant_users,
            count(*) FILTER (WHERE role = 'Super Owner')::int       AS super_owners
          FROM users`),
        client.query(`SELECT count(*)::int n FROM organization_subscriptions WHERE status = 'active'`),
        client.query(`
          SELECT p.code, p.name, count(os.id)::int n
            FROM plans p
            LEFT JOIN organization_subscriptions os
              ON os.plan_id = p.id AND os.status = 'active'
           GROUP BY p.id ORDER BY p.name`),
        client.query(`SELECT count(*)::int n FROM modules`),
        client.query(`
          SELECT o.id, o.name, o.slug, o.status, o.created_at, p.name AS plan_name,
                 (SELECT count(*) FROM users u WHERE u.organization_id = o.id)::int AS user_count
            FROM organizations o
            LEFT JOIN organization_subscriptions os ON os.organization_id = o.id AND os.status = 'active'
            LEFT JOIN plans p ON p.id = os.plan_id
           ORDER BY o.created_at DESC LIMIT 6`),
        client.query(`
          SELECT to_char(date_trunc('month', created_at), 'Mon YYYY') AS label,
                 date_trunc('month', created_at) AS month, count(*)::int n
            FROM organizations
           WHERE created_at >= (date_trunc('month', NOW()) - INTERVAL '5 months')
           GROUP BY 1, 2 ORDER BY 2`),
        client.query(`
          SELECT COALESCE(SUM(p.price_monthly), 0)::numeric AS mrr
            FROM organization_subscriptions os JOIN plans p ON p.id = os.plan_id
           WHERE os.status = 'active'`),
      ]);

      const byStatus: Record<string, number> = {};
      for (const r of statuses.rows) byStatus[r.status] = r.n;

      return {
        organizations: { total: orgs.rows[0].n, byStatus },
        users: users.rows[0],
        activeSubscriptions: subs.rows[0].n,
        modules: modules.rows[0].n,
        planDistribution: planDist.rows,
        recentOrganizations: recent.rows,
        growth: growth.rows.map((r: any) => ({ label: r.label, n: r.n })),
        mrr: Number(mrr.rows[0]?.mrr ?? 0),
      };
    });
    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
