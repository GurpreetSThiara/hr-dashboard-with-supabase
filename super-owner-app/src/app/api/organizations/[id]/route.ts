import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/** GET /api/organizations/[id] — org detail + active plan + subscription history. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperOwner(request);
    const { id } = await params;
    const data = await withPgClient(async (client) => {
      const org = await client.query(
        `SELECT o.*, p.code AS plan_code, p.name AS plan_name,
                (SELECT count(*) FROM users u WHERE u.organization_id = o.id)::int AS user_count
           FROM organizations o
           LEFT JOIN organization_subscriptions os ON os.organization_id = o.id AND os.status = 'active'
           LEFT JOIN plans p ON p.id = os.plan_id
          WHERE o.id = $1`,
        [id]
      );
      if (!org.rows[0]) return null;

      const modules = await client.query(
        `SELECT m.code FROM organization_subscriptions os
           JOIN plan_modules pm ON pm.plan_id = os.plan_id
           JOIN modules m ON m.id = pm.module_id
          WHERE os.organization_id = $1 AND os.status = 'active'
          ORDER BY m.code`,
        [id]
      );
      const history = await client.query(
        `SELECT os.id, os.status, os.starts_at, os.ends_at, p.name AS plan_name
           FROM organization_subscriptions os JOIN plans p ON p.id = os.plan_id
          WHERE os.organization_id = $1 ORDER BY os.starts_at DESC`,
        [id]
      );
      return {
        ...org.rows[0],
        modules: modules.rows.map((r: any) => r.code),
        subscriptionHistory: history.rows,
      };
    });
    if (!data) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** PATCH /api/organizations/[id] — update name, status, maintenance, branding, notes. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperOwner(request);
    const { id } = await params;
    const body = await request.json();
    const sets: string[] = [];
    const vals: any[] = [];

    if (typeof body.name === 'string' && body.name.trim()) { vals.push(body.name.trim()); sets.push(`name = $${vals.length}`); }
    if (typeof body.status === 'string') {
      if (!['active', 'suspended', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      vals.push(body.status); sets.push(`status = $${vals.length}`);
    }
    if (typeof body.maintenance_mode === 'boolean') { vals.push(body.maintenance_mode); sets.push(`maintenance_mode = $${vals.length}`); }
    if (typeof body.suspended_reason === 'string') { vals.push(body.suspended_reason || null); sets.push(`suspended_reason = $${vals.length}`); }
    if (typeof body.primary_color === 'string') {
      if (!/^#[0-9a-fA-F]{6}$/.test(body.primary_color)) return NextResponse.json({ error: 'primary_color must be a hex like #4f46e5' }, { status: 400 });
      vals.push(body.primary_color); sets.push(`primary_color = $${vals.length}`);
    }
    if (typeof body.logo_url === 'string') { vals.push(body.logo_url || null); sets.push(`logo_url = $${vals.length}`); }
    if (typeof body.notes === 'string') { vals.push(body.notes || null); sets.push(`notes = $${vals.length}`); }
    if (typeof body.primary_contact_email === 'string') { vals.push(body.primary_contact_email || null); sets.push(`primary_contact_email = $${vals.length}`); }

    if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const updated = await withPgClient(async (client) => {
      vals.push(id);
      const res = await client.query(
        `UPDATE organizations SET ${sets.join(', ')}, updated_at = NOW()
          WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      if (res.rows[0]) {
        await logAudit(client, actor.email, 'organization.update', 'organization', id, {
          fields: Object.keys(body),
          status: body.status, maintenance_mode: body.maintenance_mode,
        });
      }
      return res.rows[0];
    });
    if (!updated) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
