import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';

/** GET /api/audit — recent platform audit entries (latest 200). */
export async function GET(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `SELECT id, actor_email, action, target_type, target_id, detail, created_at
           FROM platform_audit_log ORDER BY created_at DESC LIMIT 200`);
      return res.rows;
    });
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
