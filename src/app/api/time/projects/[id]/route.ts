/**
 * Single project.
 *   PATCH  /api/time/projects/[id]   — update (manage_time_admin)
 *   DELETE /api/time/projects/[id]   — delete (manage_time_admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requirePermission, authError } from '@/lib/apiAuth';

const EDITABLE = [
  'name', 'code', 'client_id', 'status', 'color', 'is_billable',
  'billing_rate', 'estimated_hours', 'budget_amount', 'department',
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'manage_time_admin');
    const { id } = await params;
    const body = await request.json();

    const sets: string[] = [];
    const vals: any[] = [];
    for (const k of EDITABLE) {
      if (k in body) { vals.push(body[k]); sets.push(`${k} = $${vals.length}`); }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'No editable fields' }, { status: 400 });
    vals.push(id);

    const row = await withPgClient((c) =>
      c.query(
        `UPDATE projects SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING *`,
        vals
      ).then((r: any) => r.rows[0])
    );
    if (!row) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'manage_time_admin');
    const { id } = await params;
    await withPgClient((c) => c.query(`DELETE FROM projects WHERE id = $1`, [id]));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
