/**
 * Field-Level Security config for a custom field.
 *   GET — list the field's permission rows.
 *   PUT — replace the field's permission rows (full set). Admin only. Audited.
 *
 * No rows ⇒ the field is unrestricted (open to anyone with record access).
 * Any rows ⇒ the field is restricted to the listed principals.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    await requireAdmin(request);
    const { id, fieldId } = await params;
    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `SELECT id, principal_type, principal_id, can_view, can_edit
         FROM field_permissions WHERE object_id = $1 AND field_id = $2
         ORDER BY created_at`,
        [id, fieldId]
      );
      return res.rows;
    });
    return NextResponse.json({ permissions: rows });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const actor = await requireAdmin(request);
    const { id, fieldId } = await params;
    const body = await request.json();
    const perms: any[] = Array.isArray(body?.permissions) ? body.permissions : [];

    for (const p of perms) {
      if (!['user', 'role', 'role_group', 'department'].includes(p.principal_type) || !p.principal_id?.trim()) {
        return NextResponse.json({ error: 'Each row needs principal_type and principal_id' }, { status: 400 });
      }
    }

    const saved = await withPgClient(async (client) => {
      const fld = await client.query('SELECT label FROM custom_fields WHERE id = $1 AND object_id = $2', [fieldId, id]);
      if (fld.rows.length === 0) throw new ApiAuthError('Field not found', 404);

      await client.query('BEGIN');
      try {
        await client.query('DELETE FROM field_permissions WHERE object_id = $1 AND field_id = $2', [id, fieldId]);
        for (const p of perms) {
          await client.query(
            `INSERT INTO field_permissions (object_id, field_id, principal_type, principal_id, can_view, can_edit, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [id, fieldId, p.principal_type, p.principal_id.trim(), p.can_view !== false, !!p.can_edit, actor.email]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }

      logAdminAction({
        actor, action: 'field_permissions.update', entityType: 'custom_field', entityId: fieldId,
        summary: `Updated FLS for field "${fld.rows[0].label}" (${perms.length} rule(s))`,
        newValue: perms, request,
      });
      return perms;
    });

    return NextResponse.json({ permissions: saved });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
