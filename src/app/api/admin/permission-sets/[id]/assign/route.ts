/**
 * POST   /api/admin/permission-sets/[id]/assign
 *        { principal_type: 'user'|'role_group', principal_id, expires_at? }
 *        Grants the set to a user/group (optionally time-boxed). Audited.
 * DELETE /api/admin/permission-sets/[id]/assign  { assignment_id }  — revoke.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const { principal_type, principal_id, expires_at } = await request.json();

    if (!['user', 'role_group'].includes(principal_type) || !principal_id?.trim()) {
      return NextResponse.json({ error: 'principal_type (user|role_group) and principal_id are required' }, { status: 400 });
    }

    const row = await withPgClient(async (client) => {
      const set = await client.query('SELECT name FROM permission_sets WHERE id = $1', [id]);
      if (set.rows.length === 0) throw new ApiAuthError('Permission set not found', 404);

      const res = await client.query(
        `INSERT INTO permission_set_assignments (set_id, principal_type, principal_id, granted_by, expires_at, is_active)
         VALUES ($1,$2,$3,$4,$5,true)
         ON CONFLICT (set_id, principal_type, principal_id) DO UPDATE
           SET expires_at = EXCLUDED.expires_at, is_active = true, granted_by = EXCLUDED.granted_by
         RETURNING *`,
        [id, principal_type, principal_id.trim(), actor.email, expires_at || null]
      );
      logAdminAction({
        actor, action: 'permission_set.assign', entityType: 'permission_set', entityId: id,
        summary: `Granted "${set.rows[0].name}" to ${principal_type} ${principal_id}${expires_at ? ` (expires ${expires_at})` : ''}`,
        newValue: res.rows[0], request,
      });
      return res.rows[0];
    });
    return NextResponse.json({ assignment: row }, { status: 201 });
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
    const { assignment_id } = await request.json();
    if (!assignment_id) return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 });

    await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE permission_set_assignments SET is_active = false
         WHERE id = $1 AND set_id = $2 RETURNING *`,
        [assignment_id, id]
      );
      if (res.rows.length === 0) throw new ApiAuthError('Assignment not found', 404);
      logAdminAction({
        actor, action: 'permission_set.revoke', entityType: 'permission_set', entityId: id,
        summary: `Revoked grant from ${res.rows[0].principal_type} ${res.rows[0].principal_id}`,
        oldValue: res.rows[0], request,
      });
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
