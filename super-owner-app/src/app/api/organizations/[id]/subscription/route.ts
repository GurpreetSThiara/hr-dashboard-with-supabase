import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/**
 * PUT /api/organizations/[id]/subscription — assign / change the org's plan,
 * with optional trial/expiry date.
 * Body: { planCode, endsAt?: ISO string | null }. Cancels the active
 * subscription and activates the new plan. Never deletes data on downgrade.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperOwner(request);
    const { id: organizationId } = await params;
    const body = await request.json();
    const planCode = String(body.planCode ?? '');
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (!planCode) return NextResponse.json({ error: 'planCode is required' }, { status: 400 });
    if (endsAt && isNaN(endsAt.getTime())) return NextResponse.json({ error: 'endsAt is not a valid date' }, { status: 400 });

    const result = await withPgClient(async (client) => {
      try {
        await client.query('BEGIN');

        const org = await client.query(`SELECT id FROM organizations WHERE id = $1`, [organizationId]);
        if (!org.rows[0]) throw Object.assign(new Error('Organization not found'), { status: 404 });

        const plan = await client.query(`SELECT id FROM plans WHERE code = $1 AND is_active = true`, [planCode]);
        if (!plan.rows[0]) throw Object.assign(new Error(`Unknown plan: ${planCode}`), { status: 400 });

        await client.query(
          `UPDATE organization_subscriptions
              SET status = 'cancelled', ends_at = COALESCE(ends_at, NOW()), updated_at = NOW()
            WHERE organization_id = $1 AND status = 'active'`,
          [organizationId]
        );
        const sub = await client.query(
          `INSERT INTO organization_subscriptions (organization_id, plan_id, status, ends_at)
           VALUES ($1, $2, 'active', $3) RETURNING *`,
          [organizationId, plan.rows[0].id, endsAt ? endsAt.toISOString() : null]
        );

        await logAudit(client, actor.email, 'organization.subscription', 'organization', organizationId, { planCode, endsAt: endsAt?.toISOString() ?? null });
        await client.query('COMMIT');
        return sub.rows[0];
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: error.status ?? 400 });
  }
}
