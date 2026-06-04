/**
 * PUT    /api/admin/custom-objects/[id]/fields/[fieldId]
 *        Update field metadata: label, required, unique, default, picklist values,
 *        display_order (reorder), is_archived (archive/restore).
 * DELETE archives the field (soft).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id, fieldId } = await params;
    const b = await request.json();

    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE custom_fields
         SET label           = COALESCE($1, label),
             is_required     = COALESCE($2, is_required),
             is_unique       = COALESCE($3, is_unique),
             default_value   = COALESCE($4, default_value),
             picklist_values = COALESCE($5, picklist_values),
             display_order   = COALESCE($6, display_order),
             is_archived     = COALESCE($7, is_archived),
             config          = COALESCE($8, config),
             updated_at      = NOW()
         WHERE id = $9 AND object_id = $10
         RETURNING *`,
        [
          b.label ?? null,
          b.is_required ?? null,
          b.is_unique ?? null,
          b.default_value ?? null,
          b.picklist_values !== undefined ? JSON.stringify(b.picklist_values) : null,
          b.display_order ?? null,
          b.is_archived ?? null,
          b.config ?? null,
          fieldId, id,
        ]
      );
      if (res.rows.length === 0) throw new ApiAuthError('Field not found', 404);
      return res.rows[0];
    });

    logAdminAction({
      actor, action: 'custom_field.update', entityType: 'custom_field', entityId: fieldId,
      summary: `Updated field "${row.label}"`, newValue: row, request,
    });
    return NextResponse.json({ field: row });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id, fieldId } = await params;
    await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE custom_fields SET is_archived = true, updated_at = NOW()
         WHERE id = $1 AND object_id = $2 RETURNING label`,
        [fieldId, id]
      );
      if (res.rows.length === 0) throw new ApiAuthError('Field not found', 404);
      logAdminAction({ actor, action: 'custom_field.archive', entityType: 'custom_field', entityId: fieldId, summary: `Archived field "${res.rows[0].label}"`, request });
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
