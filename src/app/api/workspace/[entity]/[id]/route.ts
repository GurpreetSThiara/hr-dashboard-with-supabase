import { NextRequest, NextResponse } from 'next/server';
import { withTenantPgClient } from '@/lib/pgClient';
import { requireWritable, authError, ApiAuthError } from '@/lib/apiAuth';
import { getEntity } from '@/lib/workspaceEntities';

/** PATCH /api/workspace/[entity]/[id] — update whitelisted columns (own org). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const actor = await requireWritable(request);
    const { entity, id } = await params;
    const cfg = getEntity(entity);
    if (!cfg) throw new ApiAuthError('Unknown entity', 404);
    if (!actor.organizationId) throw new ApiAuthError('No organization context', 403);
    const body = await request.json();

    const sets: string[] = [];
    const vals: any[] = [];
    for (const c of cfg.columns) {
      if (c in body) {
        const isJson = cfg.jsonColumns?.includes(c);
        vals.push(isJson ? JSON.stringify(body[c]) : body[c]);
        sets.push(`${c} = $${vals.length}`);
      }
    }
    if (sets.length === 0) throw new ApiAuthError('Nothing to update', 400);

    const updated = await withTenantPgClient(actor.organizationId, async (client) => {
      vals.push(id); const idP = `$${vals.length}`;
      vals.push(actor.organizationId); const orgP = `$${vals.length}`;
      let where = `id = ${idP} AND organization_id = ${orgP}`;
      if (cfg.ownerColumn) { vals.push(actor.email); where += ` AND ${cfg.ownerColumn} = $${vals.length}`; }
      const res = await client.query(`UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE ${where} RETURNING *`, vals);
      return res.rows[0];
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** DELETE /api/workspace/[entity]/[id] — delete a row in the actor's org. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const actor = await requireWritable(request);
    const { entity, id } = await params;
    const cfg = getEntity(entity);
    if (!cfg) throw new ApiAuthError('Unknown entity', 404);
    if (!actor.organizationId) throw new ApiAuthError('No organization context', 403);

    await withTenantPgClient(actor.organizationId, async (client) => {
      const vals: any[] = [id, actor.organizationId];
      let where = 'id = $1 AND organization_id = $2';
      if (cfg.ownerColumn) { vals.push(actor.email); where += ` AND ${cfg.ownerColumn} = $${vals.length}`; }
      await client.query(`DELETE FROM ${cfg.table} WHERE ${where}`, vals);
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
