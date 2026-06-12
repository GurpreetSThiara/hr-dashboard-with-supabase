import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';

/**
 * PATCH /api/plans/[id] — update plan fields and/or its enabled module set.
 * Body: { name?, description?, is_active?, moduleCodes?: string[] }.
 * When moduleCodes is provided it REPLACES the plan's module set.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperOwner(request);
    const { id } = await params;
    const body = await request.json();

    const result = await withPgClient(async (client) => {
      try {
        await client.query('BEGIN');
        const exists = await client.query(`SELECT id FROM plans WHERE id = $1`, [id]);
        if (!exists.rows[0]) throw Object.assign(new Error('Plan not found'), { status: 404 });

        const sets: string[] = [];
        const vals: any[] = [];
        if (typeof body.name === 'string' && body.name.trim()) { vals.push(body.name.trim()); sets.push(`name = $${vals.length}`); }
        if (typeof body.description === 'string') { vals.push(body.description); sets.push(`description = $${vals.length}`); }
        if (typeof body.is_active === 'boolean') { vals.push(body.is_active); sets.push(`is_active = $${vals.length}`); }
        if (body.price_monthly !== undefined) { vals.push(body.price_monthly); sets.push(`price_monthly = $${vals.length}`); }
        if (body.price_yearly !== undefined) { vals.push(body.price_yearly); sets.push(`price_yearly = $${vals.length}`); }
        if (typeof body.currency === 'string') { vals.push(body.currency); sets.push(`currency = $${vals.length}`); }
        if (body.limits !== undefined) { vals.push(JSON.stringify(body.limits ?? {})); sets.push(`limits = $${vals.length}::jsonb`); }
        if (sets.length) {
          vals.push(id);
          await client.query(`UPDATE plans SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
        }

        if (Array.isArray(body.moduleCodes)) {
          await client.query(`DELETE FROM plan_modules WHERE plan_id = $1`, [id]);
          if (body.moduleCodes.length) {
            await client.query(
              `INSERT INTO plan_modules (plan_id, module_id)
               SELECT $1, m.id FROM modules m WHERE m.code = ANY($2::text[])`,
              [id, body.moduleCodes]
            );
          }
        }

        const res = await client.query(`
          SELECT p.id, p.code, p.name, p.description, p.limits, p.is_active,
                 p.price_monthly, p.price_yearly, p.currency,
                 COALESCE(ARRAY_AGG(m.code ORDER BY m.code) FILTER (WHERE m.code IS NOT NULL), '{}') AS modules
            FROM plans p
            LEFT JOIN plan_modules pm ON pm.plan_id = p.id
            LEFT JOIN modules m ON m.id = pm.module_id
           WHERE p.id = $1 GROUP BY p.id`, [id]);
        await client.query('COMMIT');
        return res.rows[0];
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
