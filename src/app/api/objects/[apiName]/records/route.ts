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
import { getActorPrincipals, buildVisibleRecordsClause } from '@/lib/recordSharing';
import { resolveFieldAccess, maskRecordData } from '@/lib/fieldSecurity';

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

    const data = await withPgClient(async (client) => {
      const { object, fields } = await resolveObject(client, apiName);

      // Record-level visibility (Phase 4): owner / shares / admin. `r` alias required.
      const principals = await getActorPrincipals(client, actor);
      const vals: any[] = [object.id];
      const share = buildVisibleRecordsClause(principals, vals.length + 1);
      vals.push(...share.params);
      const where = `WHERE r.object_id = $1 AND r.deleted_at IS NULL ${share.clause}`;

      const count = await client.query(`SELECT COUNT(*) FROM custom_records r ${where}`, vals);
      const rows = await client.query(
        `SELECT r.id, r.data, r.owner_email, r.created_by, r.created_at, r.updated_at
         FROM custom_records r ${where} ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        vals
      );

      // Field-level security (Phase 5): mask non-viewable field values + annotate fields.
      const access = await resolveFieldAccess(client, principals, object.id, fields);
      const maskedRows = rows.rows.map((rec: any) => ({ ...rec, data: maskRecordData(rec.data, access) }));
      const annotatedFields = fields.map((f) => ({
        ...f,
        viewable: access.viewable.has(f.api_name),
        editable: access.editable.has(f.api_name),
      }));

      return {
        object: { id: object.id, api_name: object.api_name, label: object.label, plural_label: object.plural_label },
        fields: annotatedFields,
        data: maskedRows,
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

      // FLS: drop any fields the actor is not permitted to edit before validating.
      const principals = await getActorPrincipals(client, actor);
      const access = await resolveFieldAccess(client, principals, object.id, fields);
      const raw = input?.data ?? input ?? {};
      const filtered: Record<string, any> = {};
      for (const k of Object.keys(raw)) if (access.editable.has(k)) filtered[k] = raw[k];

      const v = await validateRecord(client, object.id, fields, filtered, undefined);
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
