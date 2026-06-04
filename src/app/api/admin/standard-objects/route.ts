/**
 * GET /api/admin/standard-objects — list system (standard) objects.
 * Read-only: standard objects cannot be created/edited/deleted (no POST/PUT/DELETE).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT o.*,
               COUNT(f.id) FILTER (WHERE f.is_custom = false)::int AS standard_field_count,
               COUNT(f.id) FILTER (WHERE f.is_custom = true)::int  AS custom_field_count
        FROM standard_objects o
        LEFT JOIN standard_object_fields f ON f.object_api_name = o.api_name
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
