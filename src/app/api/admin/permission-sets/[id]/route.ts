import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { KNOWN_PERMISSIONS } from '@/lib/accessControl';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const { name, description, permissions } = await request.json();
    const perms = Array.isArray(permissions)
      ? permissions.filter((p) => KNOWN_PERMISSIONS.includes(p))
      : null;

    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE permission_sets
         SET name = COALESCE($1,name), description = COALESCE($2,description),
             permissions = COALESCE($3, permissions), updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [name?.trim() ?? null, description ?? null, perms, id]
      );
      if (res.rows.length === 0) throw new ApiAuthError('Permission set not found', 404);
      return res.rows[0];
    });
    logAdminAction({ actor, action: 'permission_set.update', entityType: 'permission_set', entityId: id, summary: `Updated permission set "${row.name}"`, newValue: row, request });
    return NextResponse.json({ set: row });
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
      const res = await client.query('DELETE FROM permission_sets WHERE id = $1 RETURNING name', [id]);
      if (res.rows.length === 0) throw new ApiAuthError('Permission set not found', 404);
      logAdminAction({ actor, action: 'permission_set.delete', entityType: 'permission_set', entityId: id, summary: `Deleted permission set "${res.rows[0].name}"`, request });
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
