/**
 * GET /api/admin/standard-objects/[apiName] — object + its fields/relationships,
 * split into standard (system) and custom. Read-only object metadata.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError, ApiAuthError } from '@/lib/apiAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ apiName: string }> }
) {
  try {
    await requireAdmin(request);
    const { apiName } = await params;
    const data = await withPgClient(async (client) => {
      const o = await client.query(`SELECT * FROM standard_objects WHERE api_name = $1`, [apiName]);
      if (o.rows.length === 0) throw new ApiAuthError('Standard object not found', 404);
      const f = await client.query(
        `SELECT * FROM standard_object_fields WHERE object_api_name = $1 ORDER BY is_custom, label`,
        [apiName]
      );
      const fields = f.rows;
      return {
        object: o.rows[0],
        standardFields: fields.filter((x: any) => !x.is_custom),
        customFields: fields.filter((x: any) => x.is_custom),
      };
    });
    return NextResponse.json(data);
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
