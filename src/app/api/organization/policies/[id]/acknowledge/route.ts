/**
 * POST /api/organization/policies/[id]/acknowledge
 * Records the caller's acknowledgement (read receipt) of the CURRENT policy
 * version, capturing IP. Idempotent per (policy, employee, version).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError, ApiAuthError } from '@/lib/apiAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { id } = await params;
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    const result = await withPgClient(async (client) => {
      const pol = await client.query('SELECT version FROM org_policies WHERE id = $1 AND is_active = true', [id]);
      if (pol.rows.length === 0) throw new ApiAuthError('Policy not found', 404);
      const version = pol.rows[0].version;

      const res = await client.query(
        `INSERT INTO policy_acknowledgements (policy_id, policy_version, employee_email, ip_address)
         VALUES ($1, $2, LOWER($3), $4)
         ON CONFLICT (policy_id, employee_email, policy_version) DO NOTHING
         RETURNING *`,
        [id, version, actor.email, ip]
      );
      return res.rows[0] || { alreadyAcknowledged: true };
    });

    return NextResponse.json({ success: true, acknowledgement: result });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
