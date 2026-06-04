/**
 * POST   /api/admin/role-groups/[id]/members  { user_email }  — add member
 * DELETE /api/admin/role-groups/[id]/members  { user_email }  — remove member
 * Admin only. Audited.
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
    const { user_email } = await request.json();
    if (!user_email?.trim()) return NextResponse.json({ error: 'user_email is required' }, { status: 400 });

    const row = await withPgClient(async (client) => {
      const grp = await client.query('SELECT name FROM role_groups WHERE id = $1', [id]);
      if (grp.rows.length === 0) throw new ApiAuthError('Role group not found', 404);
      const res = await client.query(
        `INSERT INTO role_group_members (group_id, user_email, added_by)
         VALUES ($1, LOWER($2), $3)
         ON CONFLICT (group_id, user_email) DO NOTHING
         RETURNING *`,
        [id, user_email.trim(), actor.email]
      );
      logAdminAction({
        actor, action: 'role_group.add_member', entityType: 'role_group', entityId: id,
        summary: `Added ${user_email} to "${grp.rows[0].name}"`, newValue: { user_email }, request,
      });
      return res.rows[0] || { alreadyMember: true };
    });
    return NextResponse.json({ member: row }, { status: 201 });
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
    const { user_email } = await request.json();
    if (!user_email?.trim()) return NextResponse.json({ error: 'user_email is required' }, { status: 400 });

    await withPgClient(async (client) => {
      await client.query(
        `DELETE FROM role_group_members WHERE group_id = $1 AND LOWER(user_email) = LOWER($2)`,
        [id, user_email.trim()]
      );
      logAdminAction({
        actor, action: 'role_group.remove_member', entityType: 'role_group', entityId: id,
        summary: `Removed ${user_email} from group`, oldValue: { user_email }, request,
      });
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
