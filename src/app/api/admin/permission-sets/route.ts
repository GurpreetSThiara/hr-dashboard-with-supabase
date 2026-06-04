/**
 * Permission Sets — named bundles of permission keys assignable to users or
 * role groups (additive grants). GET list, POST create. Admin only. Audited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAdmin, authError } from '@/lib/apiAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { KNOWN_PERMISSIONS } from '@/lib/accessControl';

function validatePerms(perms: any): string[] {
  if (!Array.isArray(perms)) return [];
  return perms.filter((p) => KNOWN_PERMISSIONS.includes(p));
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT s.*, COUNT(a.id) FILTER (WHERE a.is_active)::int AS assignment_count
        FROM permission_sets s
        LEFT JOIN permission_set_assignments a ON a.set_id = s.id
        GROUP BY s.id ORDER BY s.name
      `);
      return res.rows;
    });
    return NextResponse.json({ sets: rows, knownPermissions: KNOWN_PERMISSIONS });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const { name, description, permissions } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const perms = validatePerms(permissions);

    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO permission_sets (name, description, permissions, created_by)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [name.trim(), description || null, perms, actor.email]
      );
      return res.rows[0];
    });
    logAdminAction({
      actor, action: 'permission_set.create', entityType: 'permission_set', entityId: row.id,
      summary: `Created permission set "${row.name}" (${perms.length} permissions)`, newValue: row, request,
    });
    return NextResponse.json({ set: row }, { status: 201 });
  } catch (err: any) {
    const a = authError(err); if (a) return a;
    if (err.code === '23505') return NextResponse.json({ error: 'A permission set with this name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
