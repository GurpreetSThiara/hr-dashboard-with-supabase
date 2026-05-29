import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase, getServerUser } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conn = getServerSupabase();
    let approverEmail: string | null = null;

    if (conn) {
      const user = await getServerUser(request, conn.client);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      approverEmail = user.email ?? null;
    }

    const body = await request.json();
    const { action, approver_notes } = body;

    if (!['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const data = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE leave_requests
         SET status = $1, approver_notes = $2, approver_email = $3,
             approved_at = NOW(), updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [action, approver_notes || null, approverEmail, id]
      );
      if (res.rows.length === 0) throw new Error('Leave request not found');
      return res.rows[0];
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
