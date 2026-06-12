import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/** GET /api/organizations — list all orgs + their active plan. */
export async function GET(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT o.id, o.name, o.slug, o.status, o.created_at, o.last_active_at,
               p.code AS plan_code, p.name AS plan_name,
               (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) AS user_count
          FROM organizations o
          LEFT JOIN organization_subscriptions os
            ON os.organization_id = o.id AND os.status = 'active'
          LEFT JOIN plans p ON p.id = os.plan_id
         ORDER BY o.created_at DESC
      `);
      return res.rows;
    });
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** POST /api/organizations — create an org with optional initial plan. */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperOwner(request);
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const slug = String(body.slug ?? '').trim().toLowerCase();
    const planCode = body.planCode ? String(body.planCode) : null;

    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: 'slug must be lowercase alphanumeric/hyphens' }, { status: 400 });
    }

    const created = await withPgClient(async (client) => {
      try {
        await client.query('BEGIN');
        const orgRes = await client.query(
          `INSERT INTO organizations (name, slug, status, created_by)
           VALUES ($1, $2, 'active', $3) RETURNING *`,
          [name, slug, actor.email]
        );
        const org = orgRes.rows[0];

        if (planCode) {
          const planRes = await client.query(`SELECT id FROM plans WHERE code = $1 AND is_active = true`, [planCode]);
          if (!planRes.rows[0]) throw Object.assign(new Error(`Unknown plan: ${planCode}`), { status: 400 });
          await client.query(
            `INSERT INTO organization_subscriptions (organization_id, plan_id, status)
             VALUES ($1, $2, 'active')`,
            [org.id, planRes.rows[0].id]
          );
        }
        await logAudit(client, actor.email, 'organization.create', 'organization', org.id, { name, slug, planCode });
        await client.query('COMMIT');
        return org;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An organization with this slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: error.status ?? 400 });
  }
}
