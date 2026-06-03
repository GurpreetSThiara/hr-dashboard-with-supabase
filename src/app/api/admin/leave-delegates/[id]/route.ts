import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/** DELETE  /api/admin/leave-delegates/[id]  — deactivate a delegation */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE leave_approval_delegates
         SET is_active = false
         WHERE id = $1
         RETURNING id`,
        [id]
      );
      if (res.rows.length === 0) throw new Error('Delegation not found');
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
