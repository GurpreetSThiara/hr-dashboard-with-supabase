import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';

/** GET /api/organizations/[id]/users — users belonging to the organization. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperOwner(request);
    const { id } = await params;
    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `SELECT id, email, full_name, role, tier, department
           FROM users WHERE organization_id = $1 ORDER BY tier ASC, email ASC`,
        [id]
      );
      return res.rows;
    });
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
