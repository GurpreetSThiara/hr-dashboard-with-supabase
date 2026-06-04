/**
 * POST /api/admin/custom-objects/[id]/fields — add a field to an object.
 * Validates field_type, api_name, and type-specific requirements
 * (picklist_values for picklists, lookup_object_id for lookups).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { FIELD_TYPES, PICKLIST_TYPES, LOOKUP_TYPES, isValidApiName, toApiName, type FieldType } from '@/lib/customObjects';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const b = await request.json();

    const label = (b.label || '').trim();
    const field_type = b.field_type as FieldType;
    if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    if (!FIELD_TYPES.includes(field_type)) {
      return NextResponse.json({ error: `Invalid field_type. Allowed: ${FIELD_TYPES.join(', ')}` }, { status: 400 });
    }
    const api_name = (b.api_name?.trim() || toApiName(label));
    if (!isValidApiName(api_name)) {
      return NextResponse.json({ error: 'api_name must be lowercase snake_case' }, { status: 400 });
    }

    // Type-specific validation
    if (PICKLIST_TYPES.includes(field_type)) {
      if (!Array.isArray(b.picklist_values) || b.picklist_values.length === 0) {
        return NextResponse.json({ error: 'Picklist fields require at least one picklist value' }, { status: 400 });
      }
    }
    if (LOOKUP_TYPES.includes(field_type) && !b.lookup_object_id) {
      return NextResponse.json({ error: 'Lookup fields require a lookup_object_id' }, { status: 400 });
    }
    if (field_type === 'formula' && !b.formula?.trim()) {
      return NextResponse.json({ error: 'Formula fields require a formula expression' }, { status: 400 });
    }

    const row = await withPgClient(async (client) => {
      const obj = await client.query('SELECT id FROM custom_objects WHERE id = $1', [id]);
      if (obj.rows.length === 0) throw new ApiAuthError('Object not found', 404);

      const ord = await client.query(
        `SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM custom_fields WHERE object_id = $1`,
        [id]
      );

      const res = await client.query(
        `INSERT INTO custom_fields
           (object_id, api_name, label, field_type, config, is_required, is_unique,
            default_value, picklist_values, lookup_object_id, formula, display_order, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          id, api_name, label, field_type, b.config || {},
          !!b.is_required, !!b.is_unique, b.default_value ?? null,
          PICKLIST_TYPES.includes(field_type) ? JSON.stringify(b.picklist_values) : null,
          LOOKUP_TYPES.includes(field_type) ? b.lookup_object_id : null,
          field_type === 'formula' ? b.formula : null,
          ord.rows[0].next, actor.email,
        ]
      );
      return res.rows[0];
    });

    logAdminAction({
      actor, action: 'custom_field.create', entityType: 'custom_field', entityId: row.id,
      summary: `Added field "${row.label}" (${row.field_type}) to object`, newValue: row, request,
    });
    return NextResponse.json({ field: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.code === '23505') return NextResponse.json({ error: 'A field with this api_name already exists on this object' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
