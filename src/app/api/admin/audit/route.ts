/**
 * GET /api/admin/audit — the administrative audit trail viewer.
 * Admin-only (tier ≤ 3: Super Admin / Owner / Admin). Filters: actor, action,
 * entity_type. Paginated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireMaxTier, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireMaxTier(request, 3);

    const { searchParams } = new URL(request.url);
    const actorEmail = searchParams.get('actor_email')?.toLowerCase();
    const action = searchParams.get('action')?.trim();
    const entityType = searchParams.get('entity_type')?.trim();
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const offset = (page - 1) * limit;

    const result = await withPgClient(async (client) => {
      const conds: string[] = [];
      const vals: any[] = [];
      if (actorEmail) { vals.push(actorEmail); conds.push(`LOWER(actor_email) = $${vals.length}`); }
      if (action) { vals.push(action); conds.push(`action = $${vals.length}`); }
      if (entityType) { vals.push(entityType); conds.push(`entity_type = $${vals.length}`); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      const countRes = await client.query(`SELECT COUNT(*) FROM admin_audit_log ${where}`, vals);
      const dataRes = await client.query(
        `SELECT id, actor_email, actor_role, action, entity_type, entity_id,
                summary, old_value, new_value, ip_address, user_agent, created_at
         FROM admin_audit_log ${where}
         ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        vals
      );

      // Distinct actions for the filter dropdown
      const actionsRes = await client.query(
        `SELECT DISTINCT action FROM admin_audit_log ORDER BY action`
      );

      return {
        data: dataRes.rows,
        actions: actionsRes.rows.map((r: any) => r.action),
        pagination: {
          page, limit,
          total: parseInt(countRes.rows[0].count),
          pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
        },
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const authResp = authError(err);
    if (authResp) return authResp;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
