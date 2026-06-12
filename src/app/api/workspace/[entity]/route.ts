import { NextRequest, NextResponse } from 'next/server';
import { withTenantPgClient } from '@/lib/pgClient';
import { requireAuth, requireWritable, authError, ApiAuthError } from '@/lib/apiAuth';
import { getEntity } from '@/lib/workspaceEntities';

/** GET /api/workspace/[entity] — list rows for the actor's organization. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const actor = await requireAuth(request);
    const cfg = getEntity((await params).entity);
    if (!cfg) throw new ApiAuthError('Unknown entity', 404);
    if (!actor.organizationId) return NextResponse.json({ data: [] });

    const rows = await withTenantPgClient(actor.organizationId, async (client) => {
      const vals: any[] = [actor.organizationId];
      let where = 'organization_id = $1';
      if (cfg.ownerColumn) { vals.push(actor.email); where += ` AND ${cfg.ownerColumn} = $${vals.length}`; }
      const res = await client.query(
        `SELECT * FROM ${cfg.table} WHERE ${where} ORDER BY ${cfg.orderBy ?? 'created_at DESC'}`, vals);
      return res.rows;
    });
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** POST /api/workspace/[entity] — create a row (tenant + actor fields injected). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const actor = await requireWritable(request);
    const cfg = getEntity((await params).entity);
    if (!cfg) throw new ApiAuthError('Unknown entity', 404);
    if (!actor.organizationId) throw new ApiAuthError('No organization context', 403);
    const body = await request.json();

    const cols = ['organization_id'];
    const vals: any[] = [actor.organizationId];
    for (const c of cfg.columns) {
      if (c in body && body[c] !== undefined) {
        const isJson = cfg.jsonColumns?.includes(c);
        vals.push(isJson ? JSON.stringify(body[c]) : body[c]);
        cols.push(c);
      }
    }
    if (cfg.actorEmailColumn && !cols.includes(cfg.actorEmailColumn)) {
      vals.push(actor.email); cols.push(cfg.actorEmailColumn);
    }
    const placeholders = cols.map((_, i) => `$${i + 1}`);

    const created = await withTenantPgClient(actor.organizationId, async (client) => {
      const res = await client.query(
        `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`, vals);
      return res.rows[0];
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
