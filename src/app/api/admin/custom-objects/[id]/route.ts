import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

/** GET object + its (non-archived) fields, ordered. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const data = await withPgClient(async (client) => {
      const o = await client.query('SELECT * FROM custom_objects WHERE id = $1', [id]);
      if (o.rows.length === 0) throw new ApiAuthError('Object not found', 404);
      const f = await client.query(
        `SELECT * FROM custom_fields WHERE object_id = $1 ${includeArchived ? '' : 'AND is_archived = false'}
         ORDER BY display_order, created_at`,
        [id]
      );
      return { object: o.rows[0], fields: f.rows };
    });
    return NextResponse.json(data);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const b = await request.json();
    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE custom_objects
         SET label = COALESCE($1,label), plural_label = COALESCE($2,plural_label),
             description = COALESCE($3,description), icon = COALESCE($4,icon),
             is_active = COALESCE($5,is_active), updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [b.label ?? null, b.plural_label ?? null, b.description ?? null, b.icon ?? null, b.is_active ?? null, id]
      );
      if (res.rows.length === 0) throw new ApiAuthError('Object not found', 404);
      return res.rows[0];
    });
    logAdminAction({ actor, action: 'custom_object.update', entityType: 'custom_object', entityId: id, summary: `Updated custom object "${row.label}"`, newValue: row, request });
    return NextResponse.json({ object: row });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Archive (soft delete) the object. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE custom_objects SET is_archived = true, is_active = false, updated_at = NOW() WHERE id = $1 RETURNING label`,
        [id]
      );
      if (res.rows.length === 0) throw new ApiAuthError('Object not found', 404);
      logAdminAction({ actor, action: 'custom_object.archive', entityType: 'custom_object', entityId: id, summary: `Archived custom object "${res.rows[0].label}"`, request });
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
