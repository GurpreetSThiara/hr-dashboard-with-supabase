/**
 * POST /api/admin/standard-objects/[apiName]/fields
 * Create a CUSTOM field or relationship on a standard object. Standard
 * (system) fields cannot be created here — anything created is is_custom=true.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { FIELD_TYPES, PICKLIST_TYPES, LOOKUP_TYPES, isValidApiName, toApiName, type FieldType } from '@/lib/customObjects';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { apiName } = await params;
    const b = await request.json();

    const label = (b.label || '').trim();
    if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 });

    const isRelationship = !!b.is_relationship;
    const data_type = (isRelationship ? (b.data_type || 'lookup') : (b.data_type || 'text')) as FieldType;
    if (!FIELD_TYPES.includes(data_type)) {
      return NextResponse.json({ error: `Invalid data_type. Allowed: ${FIELD_TYPES.join(', ')}` }, { status: 400 });
    }
    const api_name = (b.api_name?.trim() || toApiName(label));
    if (!isValidApiName(api_name)) {
      return NextResponse.json({ error: 'api_name must be lowercase snake_case' }, { status: 400 });
    }
    if (isRelationship || LOOKUP_TYPES.includes(data_type)) {
      if (!b.related_object?.trim()) {
        return NextResponse.json({ error: 'Relationships require a related_object' }, { status: 400 });
      }
    }
    if (PICKLIST_TYPES.includes(data_type) && (!Array.isArray(b.picklist_values) || b.picklist_values.length === 0)) {
      return NextResponse.json({ error: 'Picklist fields require at least one value' }, { status: 400 });
    }

    const row = await withPgClient(async (client) => {
      const obj = await client.query(`SELECT api_name FROM standard_objects WHERE api_name = $1`, [apiName]);
      if (obj.rows.length === 0) throw new ApiAuthError('Standard object not found', 404);

      const res = await client.query(
        `INSERT INTO standard_object_fields
           (object_api_name, api_name, label, data_type, is_relationship, related_object,
            is_custom, is_visible, is_required, picklist_values, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,true,true,$7,$8,$9) RETURNING *`,
        [
          apiName, api_name, label, data_type,
          isRelationship || LOOKUP_TYPES.includes(data_type),
          (isRelationship || LOOKUP_TYPES.includes(data_type)) ? b.related_object.trim() : null,
          !!b.is_required,
          PICKLIST_TYPES.includes(data_type) ? JSON.stringify(b.picklist_values) : null,
          actor.email,
        ]
      );
      return res.rows[0];
    });

    logAdminAction({
      actor, action: 'standard_object.add_custom_field', entityType: 'standard_object', entityId: apiName,
      summary: `Added custom ${row.is_relationship ? 'relationship' : 'field'} "${row.label}" to ${apiName}`,
      newValue: row, request,
    });
    return NextResponse.json({ field: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.code === '23505') return NextResponse.json({ error: 'A field with this api_name already exists on this object' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
