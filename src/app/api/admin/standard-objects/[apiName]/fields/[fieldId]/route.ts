/**
 * PUT/DELETE a field on a standard object — with hard guardrails:
 *
 *  - STANDARD field (is_custom = false): admins may ONLY toggle `is_visible`.
 *    Any attempt to rename/retype/require/delete is rejected.
 *  - CUSTOM field (is_custom = true): full update + delete allowed.
 *
 * Enforced server-side so system-defined metadata can never be mutated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string; fieldId: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { apiName, fieldId } = await params;
    const b = await request.json();

    const row = await withPgClient(async (client) => {
      const cur = await client.query(
        `SELECT * FROM standard_object_fields WHERE id = $1 AND object_api_name = $2`,
        [fieldId, apiName]
      );
      if (cur.rows.length === 0) throw new ApiAuthError('Field not found', 404);
      const field = cur.rows[0];

      if (!field.is_custom) {
        // STANDARD field — only visibility may change. Reject protected edits.
        const touchesProtected =
          (b.label !== undefined && b.label !== field.label) ||
          (b.data_type !== undefined && b.data_type !== field.data_type) ||
          (b.api_name !== undefined && b.api_name !== field.api_name) ||
          (b.is_required !== undefined && b.is_required !== field.is_required) ||
          (b.is_relationship !== undefined && b.is_relationship !== field.is_relationship) ||
          (b.related_object !== undefined && b.related_object !== field.related_object) ||
          (b.picklist_values !== undefined);
        if (touchesProtected) {
          throw new ApiAuthError('Standard fields cannot be modified — only their visibility can be toggled', 403);
        }
        const res = await client.query(
          `UPDATE standard_object_fields SET is_visible = COALESCE($1, is_visible), updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [b.is_visible ?? null, fieldId]
        );
        return { row: res.rows[0], action: 'toggle' };
      }

      // CUSTOM field — full update.
      const res = await client.query(
        `UPDATE standard_object_fields
         SET label = COALESCE($1,label), data_type = COALESCE($2,data_type),
             is_visible = COALESCE($3,is_visible), is_required = COALESCE($4,is_required),
             related_object = COALESCE($5,related_object),
             picklist_values = COALESCE($6,picklist_values), updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [
          b.label ?? null, b.data_type ?? null, b.is_visible ?? null, b.is_required ?? null,
          b.related_object ?? null,
          b.picklist_values !== undefined ? JSON.stringify(b.picklist_values) : null,
          fieldId,
        ]
      );
      return { row: res.rows[0], action: 'edit' };
    });

    logAdminAction({
      actor,
      action: row.action === 'toggle' ? 'standard_object.toggle_field_visibility' : 'standard_object.update_custom_field',
      entityType: 'standard_object_field', entityId: fieldId,
      summary: row.action === 'toggle'
        ? `${row.row.is_visible ? 'Showed' : 'Hid'} standard field "${row.row.label}" on ${apiName}`
        : `Updated custom field "${row.row.label}" on ${apiName}`,
      newValue: row.row, request,
    });
    return NextResponse.json({ field: row.row });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string; fieldId: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { apiName, fieldId } = await params;

    await withPgClient(async (client) => {
      const cur = await client.query(
        `SELECT * FROM standard_object_fields WHERE id = $1 AND object_api_name = $2`,
        [fieldId, apiName]
      );
      if (cur.rows.length === 0) throw new ApiAuthError('Field not found', 404);
      if (!cur.rows[0].is_custom) {
        throw new ApiAuthError('Standard fields cannot be deleted — hide them instead', 403);
      }
      await client.query(`DELETE FROM standard_object_fields WHERE id = $1`, [fieldId]);
      logAdminAction({
        actor, action: 'standard_object.delete_custom_field', entityType: 'standard_object_field', entityId: fieldId,
        summary: `Deleted custom field "${cur.rows[0].label}" from ${apiName}`, oldValue: cur.rows[0], request,
      });
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
