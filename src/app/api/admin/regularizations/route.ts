import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError, ApiAuthError } from '@/lib/apiAuth';
import { getManageableEmployeeIds, isHrScope, isManagerScope } from '@/lib/employeeVisibility';

/**
 * GET /api/admin/regularizations — the approval queue.
 *
 * Scope is REPORTING-BASED, not a coarse role list:
 *  - HR/Admin (tier ≤ 6): all requests.
 *  - Reporting managers: only requests from their reporting hierarchy.
 *  - Anyone else: 403.
 *
 * This fixes the bug where the actual reporting manager couldn't see (and so
 * couldn't action) their team's requests while unrelated managers saw everything.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);

    if (!isHrScope(actor) && !isManagerScope(actor)) {
      throw new ApiAuthError('Forbidden: you do not manage any team', 403);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const result = await withPgClient(async (client) => {
      // null = HR (all employees); otherwise restrict to the manager's hierarchy
      const ids = await getManageableEmployeeIds(client, actor);

      const conds: string[] = [];
      const vals: any[] = [];

      if (status !== 'all') {
        vals.push(status);
        conds.push(`status = $${vals.length}`);
      }
      if (ids !== null) {
        if (ids.length === 0) return [];
        vals.push(ids);
        conds.push(`employee_id = ANY($${vals.length}::uuid[])`);
      }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const res = await client.query(
        `SELECT *,
                EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0 AS age_days
         FROM attendance_regularizations
         ${where}
         ORDER BY created_at DESC`,
        vals
      );
      return res.rows;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
