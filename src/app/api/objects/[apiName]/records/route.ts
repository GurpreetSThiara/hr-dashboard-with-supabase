/**
 * Dynamic records for a custom object.
 *   GET  /api/objects/[apiName]/records       — list (owner sees own; admin all)
 *   POST /api/objects/[apiName]/records       — create (metadata-validated)
 *
 * Interim ACL (until Phase 4 record-sharing): creator owns the record; admins
 * (tier ≤ 2) see/manage all, others see/manage only records they own.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError, ApiAuthError } from '@/lib/apiAuth';
import { validateRecord, type FieldDef } from '@/lib/recordValidation';

async function resolveObject(client: any, apiName: string) {
  const o = await client.query(
    `SELECT * FROM custom_objects WHERE api_name = $1 AND is_archived = false LIMIT 1`,
    [apiName]
  );
  if (o.rows.length === 0) throw new ApiAuthError('Object not found', 404);
  const f = await client.query(
    `SELECT * FROM custom_fields WHERE object_id = $1 AND is_archived = false ORDER BY display_order`,
    [o.rows[0].id]
  );
  return { object: o.rows[0], fields: f.rows as FieldDef[] };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { apiName } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const offset = (page - 1) * limit;
    const isAdmin = actor.tier <= 2;

    const data = await withPgClient(async (client) => {
      const { object, fields } = await resolveObject(client, apiName);

      const conds = ['object_id = $1', 'deleted_at IS NULL'];
      const vals: any[] = [object.id];
      if (!isAdmin) { vals.push(actor.email.toLowerCase()); conds.push(`LOWER(owner_email) = $${vals.length}`); }
      const where = `WHERE ${conds.join(' AND ')}`;

      const count = await client.query(`SELECT COUNT(*) FROM custom_records ${where}`, vals);
      const rows = await client.query(
        `SELECT id, data, owner_email, created_by, created_at, updated_at
         FROM custom_records ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        vals
      );
      return {
        object: { id: object.id, api_name: object.api_name, label: object.label, plural_label: object.plural_label },
        fields,
        data: rows.rows,
        pagination: { page, limit, total: parseInt(count.rows[0].count), pages: Math.ceil(parseInt(count.rows[0].count) / limit) },
      };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { apiName } = await params;
    const input = await request.json();

    const result = await withPgClient(async (client) => {
      const { object, fields } = await resolveObject(client, apiName);
      const v = await validateRecord(client, object.id, fields, input?.data ?? input, undefined);
      if (!v.ok) return { validationErrors: v.errors };

      const res = await client.query(
        `INSERT INTO custom_records (object_id, data, owner_email, created_by)
         VALUES ($1, $2, $3, $3) RETURNING id, data, owner_email, created_at`,
        [object.id, JSON.stringify(v.clean), actor.email.toLowerCase()]
      );
      return { record: res.rows[0] };
    });

    if ((result as any).validationErrors) {
      return NextResponse.json({ error: 'Validation failed', fields: (result as any).validationErrors }, { status: 422 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
