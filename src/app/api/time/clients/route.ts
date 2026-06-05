/**
 * Clients for time tracking.
 *   GET  /api/time/clients   — list (any time-tracking user)
 *   POST /api/time/clients   — create (manage_time_admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'view_time_tracking');
    const rows = await withPgClient((c) =>
      c.query(`SELECT * FROM clients ORDER BY name ASC`).then((r: any) => r.rows)
    );
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
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }
    const row = await withPgClient((c) =>
      c.query(
        `INSERT INTO clients (name, code, status, color, notes, created_by)
         VALUES ($1,$2,COALESCE($3,'active'),$4,$5,$6) RETURNING *`,
        [body.name.trim(), body.code || null, body.status || null, body.color || null, body.notes || null, actor.email]
      ).then((r: any) => r.rows[0])
    );
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
