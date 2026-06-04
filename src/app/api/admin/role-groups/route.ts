/**
 * Role Groups — named collections of users for bulk access assignment.
 * GET  list (with member counts), POST create. Admin only (tier ≤ 2). Audited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT g.*, COUNT(m.id)::int AS member_count
        FROM role_groups g
        LEFT JOIN role_group_members m ON m.group_id = g.id
        GROUP BY g.id ORDER BY g.name
      `);
      return res.rows;
    });
    return NextResponse.json({ groups: rows });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const { name, description } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO role_groups (name, description, created_by) VALUES ($1,$2,$3) RETURNING *`,
        [name.trim(), description || null, actor.email]
      );
      return res.rows[0];
    });

    logAdminAction({
      actor, action: 'role_group.create', entityType: 'role_group', entityId: row.id,
      summary: `Created role group "${row.name}"`, newValue: row, request,
    });
    return NextResponse.json({ group: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.code === '23505') return NextResponse.json({ error: 'A role group with this name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
