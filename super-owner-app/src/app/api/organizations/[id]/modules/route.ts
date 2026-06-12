import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/organizations/[id]/modules — all modules with three flags each:
 * inPlan (from active plan), override ('enabled'|'disabled'|null), effective.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperOwner(request);
    const { id } = await params;
    const rows = await withPgClient(async (client) => {
      const all = await client.query(`SELECT code, name FROM modules ORDER BY code`);
      const plan = await client.query(
        `SELECT m.code FROM organization_subscriptions os
           JOIN plan_modules pm ON pm.plan_id = os.plan_id
           JOIN modules m ON m.id = pm.module_id
          WHERE os.organization_id = $1 AND os.status = 'active'`, [id]);
      const ov = await client.query(
        `SELECT module_code, enabled FROM organization_module_overrides WHERE organization_id = $1`, [id]);

      const planSet = new Set(plan.rows.map((r: any) => r.code));
      const ovMap = new Map(ov.rows.map((r: any) => [r.module_code, r.enabled]));
      return all.rows.map((m: any) => {
        const override = ovMap.has(m.code) ? (ovMap.get(m.code) ? 'enabled' : 'disabled') : null;
        const effective = override ? override === 'enabled' : planSet.has(m.code);
        return { code: m.code, name: m.name, inPlan: planSet.has(m.code), override, effective };
      });
    });
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * PUT /api/organizations/[id]/modules — set/clear an override for one module.
 * Body: { moduleCode, override: 'enabled' | 'disabled' | null }.
 * null removes the override (falls back to plan).
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSuperOwner(request);
    const { id } = await params;
    const body = await request.json();
    const moduleCode = String(body.moduleCode ?? '');
    const override = body.override ?? null;
    if (!moduleCode) return NextResponse.json({ error: 'moduleCode is required' }, { status: 400 });
    if (override !== null && !['enabled', 'disabled'].includes(override)) {
      return NextResponse.json({ error: "override must be 'enabled', 'disabled' or null" }, { status: 400 });
    }

    await withPgClient(async (client) => {
      if (override === null) {
        await client.query(
          `DELETE FROM organization_module_overrides WHERE organization_id = $1 AND module_code = $2`,
          [id, moduleCode]);
      } else {
        await client.query(
          `INSERT INTO organization_module_overrides (organization_id, module_code, enabled, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (organization_id, module_code)
           DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
          [id, moduleCode, override === 'enabled', actor.email]);
      }
      await logAudit(client, actor.email, 'organization.module_override', 'organization', id, { moduleCode, override });
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
