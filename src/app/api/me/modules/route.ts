import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';

/**
 * GET /api/me/modules — the module codes enabled for the caller's organization
 * via its active subscription's plan. Super Owner gets all modules. Used by the
 * frontend to gate plan-based navigation/UI.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);

    const result = await withPgClient(async (client) => {
      if (actor.isSuperOwner) {
        const all = await client.query(`SELECT code FROM modules ORDER BY code`);
        return {
          isSuperOwner: true,
          organizationId: null,
          modules: all.rows.map((r: any) => r.code),
        };
      }
      if (!actor.organizationId) {
        return { isSuperOwner: false, organizationId: null, modules: [] };
      }
      const res = await client.query(
        `SELECT m.code
           FROM organization_subscriptions os
           JOIN plan_modules pm ON pm.plan_id = os.plan_id
           JOIN modules m       ON m.id = pm.module_id
          WHERE os.organization_id = $1
            AND os.status = 'active'
          ORDER BY m.code`,
        [actor.organizationId]
      );
      return {
        isSuperOwner: false,
        organizationId: actor.organizationId,
        modules: res.rows.map((r: any) => r.code),
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
