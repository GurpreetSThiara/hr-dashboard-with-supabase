import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

/** GET one role group + its members */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const data = await withPgClient(async (client) => {
      const g = await client.query('SELECT * FROM role_groups WHERE id = $1', [id]);
      if (g.rows.length === 0) throw new ApiAuthError('Role group not found', 404);
      const members = await client.query(
        `SELECT m.id, m.user_email, m.added_by, m.created_at,
                e.first_name, e.last_name, u.role
         FROM role_group_members m
         LEFT JOIN employees e ON LOWER(e.email) = LOWER(m.user_email)
         LEFT JOIN users u ON LOWER(u.email) = LOWER(m.user_email)
         WHERE m.group_id = $1 ORDER BY m.created_at`,
        [id]
      );
      return { group: g.rows[0], members: members.rows };
    });
    return NextResponse.json(data);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const { name, description } = await request.json();
    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE role_groups SET name = COALESCE($1,name), description = COALESCE($2,description),
         updated_at = NOW() WHERE id = $3 RETURNING *`,
        [name?.trim() ?? null, description ?? null, id]
      );
      if (res.rows.length === 0) throw new ApiAuthError('Role group not found', 404);
      return res.rows[0];
    });
    logAdminAction({ actor, action: 'role_group.update', entityType: 'role_group', entityId: id, summary: `Updated role group "${row.name}"`, newValue: row, request });
    return NextResponse.json({ group: row });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    await withPgClient(async (client) => {
      const res = await client.query('DELETE FROM role_groups WHERE id = $1 RETURNING name', [id]);
      if (res.rows.length === 0) throw new ApiAuthError('Role group not found', 404);
      logAdminAction({ actor, action: 'role_group.delete', entityType: 'role_group', entityId: id, summary: `Deleted role group "${res.rows[0].name}"`, request });
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
