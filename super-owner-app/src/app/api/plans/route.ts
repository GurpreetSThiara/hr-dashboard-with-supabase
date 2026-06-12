import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';

/** GET /api/plans — catalog of plans with their enabled modules. */
export async function GET(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT p.id, p.code, p.name, p.description, p.limits, p.is_active,
               p.price_monthly, p.price_yearly, p.currency,
               COALESCE(
                 ARRAY_AGG(m.code ORDER BY m.code) FILTER (WHERE m.code IS NOT NULL),
                 '{}'
               ) AS modules
          FROM plans p
          LEFT JOIN plan_modules pm ON pm.plan_id = p.id
          LEFT JOIN modules m       ON m.id = pm.module_id
         GROUP BY p.id
         ORDER BY p.name
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

/**
 * POST /api/plans — create a plan with optional module set.
 * Body: { code, name, description?, limits?, moduleCodes?: string[] }.
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const body = await request.json();
    const code = String(body.code ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    if (!code || !name) return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    if (!/^[a-z0-9_-]+$/.test(code)) {
      return NextResponse.json({ error: 'code must be lowercase alphanumeric/_/-' }, { status: 400 });
    }
    const moduleCodes: string[] = Array.isArray(body.moduleCodes) ? body.moduleCodes : [];

    const created = await withPgClient(async (client) => {
      try {
        await client.query('BEGIN');
        const res = await client.query(
          `INSERT INTO plans (code, name, description, limits, price_monthly, price_yearly, currency)
           VALUES ($1, $2, $3, COALESCE($4,'{}')::jsonb, $5, $6, COALESCE($7,'USD')) RETURNING *`,
          [code, name, body.description ?? null, body.limits ? JSON.stringify(body.limits) : null,
           body.price_monthly ?? null, body.price_yearly ?? null, body.currency ?? null]
        );
        const plan = res.rows[0];
        if (moduleCodes.length) {
          await client.query(
            `INSERT INTO plan_modules (plan_id, module_id)
             SELECT $1, m.id FROM modules m WHERE m.code = ANY($2::text[])
             ON CONFLICT DO NOTHING`,
            [plan.id, moduleCodes]
          );
        }
        await client.query('COMMIT');
        return plan;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    if (error.code === '23505') return NextResponse.json({ error: 'A plan with this code already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
