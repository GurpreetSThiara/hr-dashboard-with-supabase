import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/** GET  /api/admin/leave-visibility-config  — list all rows */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `SELECT id, viewer_role, scope, is_active, updated_by, updated_at
         FROM leave_visibility_config
         ORDER BY viewer_role`
      );
      return res.rows;
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT  /api/admin/leave-visibility-config
 * Body: [ { viewer_role, scope, is_active }, ... ]
 * Upserts entire config in one go.
 */
export async function PUT(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: Array<{ viewer_role: string; scope: string; is_active?: boolean }> =
      await request.json();

    const validScopes = ['self', 'direct_reports', 'full_hierarchy', 'department', 'all'];
    for (const row of body) {
      if (!row.viewer_role || !validScopes.includes(row.scope)) {
        return NextResponse.json(
          { error: `Invalid row: viewer_role="${row.viewer_role}" scope="${row.scope}"` },
          { status: 400 }
        );
      }
    }

    const rows = await withPgClient(async (client) => {
      const results = [];
      for (const row of body) {
        const res = await client.query(
          `INSERT INTO leave_visibility_config (viewer_role, scope, is_active, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (viewer_role) DO UPDATE
             SET scope      = EXCLUDED.scope,
                 is_active  = EXCLUDED.is_active,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = EXCLUDED.updated_at
           RETURNING *`,
          [row.viewer_role, row.scope, row.is_active ?? true, actor.email]
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
