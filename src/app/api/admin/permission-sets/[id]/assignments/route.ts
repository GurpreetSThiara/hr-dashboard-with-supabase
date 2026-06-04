/**
 * GET /api/admin/permission-sets/[id]/assignments — list active assignments
 * (with expiry status). Admin only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError } from '@/lib/apiAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `SELECT a.*,
                (a.expires_at IS NOT NULL AND a.expires_at <= now()) AS expired,
                rg.name AS group_name
         FROM permission_set_assignments a
         LEFT JOIN role_groups rg ON rg.id::text = a.principal_id AND a.principal_type = 'role_group'
         WHERE a.set_id = $1 AND a.is_active = true
         ORDER BY a.created_at DESC`,
        [id]
      );
      return res.rows;
    });
    return NextResponse.json({ assignments: rows });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
