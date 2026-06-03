import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/**
 * GET  /api/admin/leave-audit
 * Query params: page, limit, actor_email, leave_request_id, action
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page            = parseInt(searchParams.get('page')  || '1');
    const limit           = parseInt(searchParams.get('limit') || '50');
    const offset          = (page - 1) * limit;
    const filterEmail     = searchParams.get('actor_email')?.toLowerCase();
    const filterLeaveId   = searchParams.get('leave_request_id');
    const filterAction    = searchParams.get('action');

    const result = await withPgClient(async (client) => {
      const conditions: string[] = [];
      const values: any[]        = [];

      if (filterEmail) {
        values.push(filterEmail);
        conditions.push(`LOWER(actor_email) = $${values.length}`);
      }
      if (filterLeaveId) {
        values.push(filterLeaveId);
        conditions.push(`leave_request_id = $${values.length}`);
      }
      if (filterAction) {
        values.push(filterAction);
        conditions.push(`action = $${values.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await client.query(
        `SELECT COUNT(*) FROM leave_audit_log ${where}`,
        values
      );
      const dataRes = await client.query(
        `SELECT id, leave_request_id, actor_email, actor_role, action,
                old_value, new_value, created_at
         FROM leave_audit_log
         ${where}
         ORDER BY created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        values
      );

      return {
        data: dataRes.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countRes.rows[0].count),
          pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
        },
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
