import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const activatedBy = body?.activated_by_email || null;

    const version = await withPgClient(async (client) => {
      const check = await client.query(
        'SELECT id, status, name FROM leave_policy_versions WHERE id = $1',
        [id]
      );
      if (check.rows.length === 0) throw new Error('Version not found');
      if (check.rows[0].status === 'active') {
        throw new Error('This version is already active.');
      }

      // Supersede all currently active versions
      await client.query(
        `UPDATE leave_policy_versions
         SET status = 'superseded', is_active = false, updated_at = NOW()
         WHERE is_active = true`
      );

      // Activate the target version
      const res = await client.query(
        `UPDATE leave_policy_versions
         SET status = 'active', is_active = true,
             activated_by_email = $1, activated_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [activatedBy, id]
      );

      return res.rows[0];
    });

    return NextResponse.json({ success: true, version });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
