/**
 *   GET    /api/objects/[apiName]/records/[recordId]   — requires VIEW
 *   PUT    .../[recordId]   — update; requires EDIT
 *   DELETE .../[recordId]   — soft delete; requires DELETE
 *
 * Access is resolved by the record-sharing engine (ownership / admin /
 * user / role / role-group / department shares).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError, ApiAuthError, type AuthedActor } from '@/lib/apiAuth';
import { validateRecord, type FieldDef } from '@/lib/recordValidation';
import { getActorPrincipals, resolveRecordAccess, meets, type AccessLevel } from '@/lib/recordSharing';
import { resolveFieldAccess, maskRecordData } from '@/lib/fieldSecurity';

async function loadContext(client: any, apiName: string, recordId: string) {
  const o = await client.query(
    `SELECT * FROM custom_objects WHERE api_name = $1 AND is_archived = false LIMIT 1`,
    [apiName]
  );
  if (o.rows.length === 0) throw new ApiAuthError('Object not found', 404);
  const rec = await client.query(
    `SELECT * FROM custom_records WHERE id = $1 AND object_id = $2 AND deleted_at IS NULL`,
    [recordId, o.rows[0].id]
  );
  if (rec.rows.length === 0) throw new ApiAuthError('Record not found', 404);
  const f = await client.query(
    `SELECT * FROM custom_fields WHERE object_id = $1 AND is_archived = false ORDER BY display_order`,
    [o.rows[0].id]
  );
  return { object: o.rows[0], record: rec.rows[0], fields: f.rows as FieldDef[] };
}

/** Throws 403 unless the actor has at least `required` access on the record. */
async function requireRecordAccess(client: any, actor: AuthedActor, record: any, required: AccessLevel) {
  const principals = await getActorPrincipals(client, actor);
  const level = await resolveRecordAccess(client, principals, record);
  if (!meets(level, required)) throw new ApiAuthError(`Forbidden — requires ${required} access`, 403);
  return level;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string; recordId: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { apiName, recordId } = await params;
    const data = await withPgClient(async (client) => {
      const ctx = await loadContext(client, apiName, recordId);
      await requireRecordAccess(client, actor, ctx.record, 'view');
      // FLS: mask non-viewable field values + annotate editability.
      const principals = await getActorPrincipals(client, actor);
      const access = await resolveFieldAccess(client, principals, ctx.object.id, ctx.fields);
      const masked = { ...ctx.record, data: maskRecordData(ctx.record.data, access) };
      const annotated = ctx.fields.map((f) => ({ ...f, viewable: access.viewable.has(f.api_name), editable: access.editable.has(f.api_name) }));
      return { record: masked, fields: annotated };
    });
    return NextResponse.json(data);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string; recordId: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { apiName, recordId } = await params;
    const input = await request.json();

    const result = await withPgClient(async (client) => {
      const ctx = await loadContext(client, apiName, recordId);
      await requireRecordAccess(client, actor, ctx.record, 'edit');

      // FLS: only allow writes to fields the actor may edit.
      const principals = await getActorPrincipals(client, actor);
      const access = await resolveFieldAccess(client, principals, ctx.object.id, ctx.fields);
      const incoming = input?.data ?? input ?? {};
      const allowedIncoming: Record<string, any> = {};
      for (const k of Object.keys(incoming)) if (access.editable.has(k)) allowedIncoming[k] = incoming[k];

      // Merge so partial updates keep existing values, then validate the merge.
      const merged = { ...ctx.record.data, ...allowedIncoming };
      const v = await validateRecord(client, ctx.object.id, ctx.fields, merged, recordId);
      if (!v.ok) return { validationErrors: v.errors };

      const res = await client.query(
        `UPDATE custom_records SET data = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, data, owner_email, updated_at`,
        [JSON.stringify(v.clean), recordId]
      );
      return { record: res.rows[0] };
    });

    if ((result as any).validationErrors) {
      return NextResponse.json({ error: 'Validation failed', fields: (result as any).validationErrors }, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string; recordId: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { apiName, recordId } = await params;
    await withPgClient(async (client) => {
      const ctx = await loadContext(client, apiName, recordId);
      await requireRecordAccess(client, actor, ctx.record, 'delete');
      await client.query(`UPDATE custom_records SET deleted_at = NOW() WHERE id = $1`, [recordId]);
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
