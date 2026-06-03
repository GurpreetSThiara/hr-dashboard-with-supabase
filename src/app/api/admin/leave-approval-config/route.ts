import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/** GET  /api/admin/leave-approval-config  — list all rows */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `SELECT id, approver_role, scope, is_active, updated_by, updated_at
         FROM leave_approval_config
         ORDER BY approver_role`
      );
      return res.rows;
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT  /api/admin/leave-approval-config
 * Body: [ { approver_role, scope, is_active }, ... ]
 * Upserts entire config in one go.
 */
export async function PUT(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: Array<{ approver_role: string; scope: string; is_active?: boolean }> =
      await request.json();

    const validScopes = ['none', 'direct_reports', 'full_hierarchy', 'all'];
    for (const row of body) {
      if (!row.approver_role || !validScopes.includes(row.scope)) {
        return NextResponse.json(
          { error: `Invalid row: approver_role="${row.approver_role}" scope="${row.scope}"` },
          { status: 400 }
        );
      }
    }

    const rows = await withPgClient(async (client) => {
      const results = [];
      for (const row of body) {
        const res = await client.query(
          `INSERT INTO leave_approval_config (approver_role, scope, is_active, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (approver_role) DO UPDATE
             SET scope      = EXCLUDED.scope,
                 is_active  = EXCLUDED.is_active,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = EXCLUDED.updated_at
           RETURNING *`,
          [row.approver_role, row.scope, row.is_active ?? true, actor.email]
        );
        results.push(res.rows[0]);
      }
      return results;
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
