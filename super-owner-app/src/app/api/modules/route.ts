import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';

/** GET /api/modules — module catalog + how many plans enable each. */
export async function GET(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT m.id, m.code, m.name, m.description,
               (SELECT count(*) FROM plan_modules pm WHERE pm.module_id = m.id)::int AS plan_count
          FROM modules m ORDER BY m.code`);
      return res.rows;
    });
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** POST /api/modules — create a module. Body: { code, name, description? }. */
export async function POST(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const body = await request.json();
    const code = String(body.code ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    if (!code || !name) return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    if (!/^[a-z0-9_]+$/.test(code)) {
      return NextResponse.json({ error: 'code must be lowercase alphanumeric/underscore' }, { status: 400 });
    }
    const created = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO modules (code, name, description) VALUES ($1, $2, $3) RETURNING *`,
        [code, name, body.description ?? null]
      );
      return res.rows[0];
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    if (error.code === '23505') return NextResponse.json({ error: 'A module with this code already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
