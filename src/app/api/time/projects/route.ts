/**
 * Projects.
 *   GET  /api/time/projects   — list (with client name + tracked-hours rollup)
 *   POST /api/time/projects   — create (manage_time_admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'view_time_tracking');
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const rows = await withPgClient(async (c) => {
      const where = status ? `WHERE p.status = $1` : '';
      const params = status ? [status] : [];
      const r = await c.query(
        `SELECT p.*, cl.name AS client_name,
                COALESCE(te.tracked_minutes, 0) AS tracked_minutes
         FROM projects p
         LEFT JOIN clients cl ON cl.id = p.client_id
         LEFT JOIN (
           SELECT project_id, SUM(duration_minutes) AS tracked_minutes
           FROM time_entries WHERE is_running = false GROUP BY project_id
         ) te ON te.project_id = p.id
         ${where}
         ORDER BY p.name ASC`,
        params
      );
      return r.rows;
    });
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission(request, 'manage_time_admin');
    const body = await request.json();
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }
    const row = await withPgClient((c) =>
      c.query(
        `INSERT INTO projects
           (name, code, client_id, status, color, is_billable, billing_rate, estimated_hours, budget_amount, department, created_by)
         VALUES ($1,$2,$3,COALESCE($4,'active'),$5,COALESCE($6,true),$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          body.name.trim(), body.code || null, body.client_id || null, body.status || null,
          body.color || null, body.is_billable, body.billing_rate ?? null,
          body.estimated_hours ?? null, body.budget_amount ?? null, body.department || null, actor.email,
        ]
      ).then((r: any) => r.rows[0])
    );
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
