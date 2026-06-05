/**
 * Tasks within projects.
 *   GET  /api/time/tasks?project_id=...   — list (filterable by project)
 *   POST /api/time/tasks                  — create (manage_time_admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'view_time_tracking');
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const rows = await withPgClient((c) => {
      const where = projectId ? `WHERE t.project_id = $1` : '';
      const params = projectId ? [projectId] : [];
      return c.query(
        `SELECT t.*, p.name AS project_name FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         ${where} ORDER BY t.name ASC`,
        params
      ).then((r: any) => r.rows);
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
    if (!body?.project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    if (!body?.name?.trim()) return NextResponse.json({ error: 'Task name is required' }, { status: 400 });
    const row = await withPgClient((c) =>
      c.query(
        `INSERT INTO tasks (project_id, name, status, is_billable, billing_rate, estimated_hours, assignee_email, created_by)
         VALUES ($1,$2,COALESCE($3,'open'),COALESCE($4,true),$5,$6,$7,$8) RETURNING *`,
        [
          body.project_id, body.name.trim(), body.status || null, body.is_billable,
          body.billing_rate ?? null, body.estimated_hours ?? null, body.assignee_email || null, actor.email,
        ]
      ).then((r: any) => r.rows[0])
    );
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
