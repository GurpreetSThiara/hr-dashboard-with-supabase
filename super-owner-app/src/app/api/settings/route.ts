import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/** GET /api/settings — global platform settings. */
export async function GET(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const row = await withPgClient(async (client) => {
      const res = await client.query(`SELECT * FROM platform_settings WHERE id = 'global'`);
      return res.rows[0] ?? null;
    });
    return NextResponse.json(row);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * PUT /api/settings — update global settings.
 * Body: { signups_enabled?, default_plan_code?, support_email? }.
 */
export async function PUT(request: NextRequest) {
  try {
    const actor = await requireSuperOwner(request);
    const b = await request.json();
    const sets: string[] = [];
    const vals: any[] = [];
    if (typeof b.signups_enabled === 'boolean') { vals.push(b.signups_enabled); sets.push(`signups_enabled = $${vals.length}`); }
    if (typeof b.default_plan_code === 'string') { vals.push(b.default_plan_code || null); sets.push(`default_plan_code = $${vals.length}`); }
    if (typeof b.support_email === 'string') { vals.push(b.support_email || null); sets.push(`support_email = $${vals.length}`); }
    if (sets.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const row = await withPgClient(async (client) => {
      vals.push(actor.email);
      const res = await client.query(
        `UPDATE platform_settings SET ${sets.join(', ')}, updated_by = $${vals.length}, updated_at = NOW()
          WHERE id = 'global' RETURNING *`, vals);
      await logAudit(client, actor.email, 'settings.update', 'platform', 'global', { fields: Object.keys(b) });
      return res.rows[0];
    });
    return NextResponse.json(row);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
