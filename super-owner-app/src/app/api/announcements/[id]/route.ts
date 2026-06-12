import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/** PATCH /api/announcements/[id] — toggle is_active. Body: { is_active }. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperOwner(request);
    const { id } = await params;
    const b = await request.json();
    if (typeof b.is_active !== 'boolean') return NextResponse.json({ error: 'is_active (boolean) required' }, { status: 400 });
    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE platform_announcements SET is_active = $1 WHERE id = $2 RETURNING *`, [b.is_active, id]);
      if (res.rows[0]) await logAudit(client, actor.email, 'announcement.toggle', 'announcement', id, { is_active: b.is_active });
      return res.rows[0];
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** DELETE /api/announcements/[id]. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperOwner(request);
    const { id } = await params;
    await withPgClient(async (client) => {
      await client.query(`DELETE FROM platform_announcements WHERE id = $1`, [id]);
      await logAudit(client, actor.email, 'announcement.delete', 'announcement', id, null);
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
