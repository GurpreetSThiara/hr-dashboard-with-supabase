/**
 * Custom Objects — metadata definitions for dynamic business entities.
 * GET list (with field counts), POST create. Admin only. Audited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { isValidApiName, toApiName } from '@/lib/customObjects';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT o.*, COUNT(f.id) FILTER (WHERE f.is_archived = false)::int AS field_count
        FROM custom_objects o
        LEFT JOIN custom_fields f ON f.object_id = o.id
        ${includeArchived ? '' : 'WHERE o.is_archived = false'}
        GROUP BY o.id ORDER BY o.label
      `);
      return res.rows;
    });
    return NextResponse.json({ objects: rows });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json();
    const label = (body.label || '').trim();
    if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 });

    const api_name = (body.api_name?.trim() || toApiName(label));
    if (!isValidApiName(api_name)) {
      return NextResponse.json({ error: 'api_name must be lowercase snake_case (letters, numbers, underscore)' }, { status: 400 });
    }

    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO custom_objects (api_name, label, plural_label, description, icon, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [api_name, label, body.plural_label || `${label}s`, body.description || null, body.icon || 'CubeIcon', actor.email]
      );
      return res.rows[0];
    });

    logAdminAction({
      actor, action: 'custom_object.create', entityType: 'custom_object', entityId: row.id,
      summary: `Created custom object "${row.label}" (${row.api_name})`, newValue: row, request,
    });
    return NextResponse.json({ object: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.code === '23505') return NextResponse.json({ error: 'An object with this api_name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
