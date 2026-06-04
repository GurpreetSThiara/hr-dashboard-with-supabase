/**
 * GET /api/organization/policies/[id]/acknowledgements
 * Compliance report: who has / hasn't acknowledged the current policy version.
 * HR / manage_policies only. Returns acknowledged list + pending (active
 * employees who haven't acknowledged the current version) + a completion rate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireManagePolicies, authError, ApiAuthError } from '@/lib/apiAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManagePolicies(request);
    const { id } = await params;

    const data = await withPgClient(async (client) => {
      const pol = await client.query('SELECT id, title, version FROM org_policies WHERE id = $1', [id]);
      if (pol.rows.length === 0) throw new ApiAuthError('Policy not found', 404);
      const version = pol.rows[0].version;

      const acked = await client.query(
        `SELECT a.employee_email, a.acknowledged_at, a.ip_address,
                e.first_name, e.last_name, e.department
         FROM policy_acknowledgements a
         LEFT JOIN employees e ON LOWER(e.email) = LOWER(a.employee_email)
         WHERE a.policy_id = $1 AND a.policy_version = $2
         ORDER BY a.acknowledged_at DESC`,
        [id, version]
      );

      const pending = await client.query(
        `SELECT e.email, e.first_name, e.last_name, e.department
         FROM employees e
         WHERE e.deleted_at IS NULL AND e.status = 'active'
           AND LOWER(e.email) NOT IN (
             SELECT LOWER(employee_email) FROM policy_acknowledgements
             WHERE policy_id = $1 AND policy_version = $2
           )
         ORDER BY e.first_name`,
        [id, version]
      );

      const total = acked.rows.length + pending.rows.length;
      const completionRate = total > 0 ? Math.round((acked.rows.length / total) * 1000) / 10 : 0;

      return {
        policy: pol.rows[0],
        acknowledged: acked.rows,
        pending: pending.rows,
        completionRate,
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
