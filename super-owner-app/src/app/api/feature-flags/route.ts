import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/** GET /api/feature-flags — all global feature flags. */
export async function GET(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const rows = await withPgClient(async (client) =>
      (await client.query(`SELECT key, description, enabled, updated_at FROM platform_feature_flags ORDER BY key`)).rows
    );
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * PUT /api/feature-flags — upsert/toggle a flag.
 * Body: { key, enabled, description? }.
 */
export async function PUT(request: NextRequest) {
  try {
    const actor = await requireSuperOwner(request);
    const b = await request.json();
    const key = String(b.key ?? '').trim();
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO platform_feature_flags (key, description, enabled, updated_by, updated_at)
         VALUES ($1, $2, COALESCE($3,false), $4, NOW())
         ON CONFLICT (key) DO UPDATE SET
           enabled = COALESCE($3, platform_feature_flags.enabled),
           description = COALESCE($2, platform_feature_flags.description),
           updated_by = $4, updated_at = NOW()
         RETURNING *`,
        [key, b.description ?? null, typeof b.enabled === 'boolean' ? b.enabled : null, actor.email]
      );
      await logAudit(client, actor.email, 'feature_flag.update', 'flag', key, { enabled: b.enabled });
      return res.rows[0];
    });
    return NextResponse.json(row);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
