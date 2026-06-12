import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSuperOwner, authError } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/** GET /api/announcements — all announcements (with org name when scoped). */
export async function GET(request: NextRequest) {
  try {
    await requireSuperOwner(request);
    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT a.*, o.name AS organization_name
          FROM platform_announcements a
          LEFT JOIN organizations o ON o.id = a.organization_id
         ORDER BY a.created_at DESC`);
      return res.rows;
    });
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/**
 * POST /api/announcements — create.
 * Body: { title, body?, level?, scope?, organizationId?, endsAt? }.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperOwner(request);
    const b = await request.json();
    const title = String(b.title ?? '').trim();
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
    const scope = b.scope === 'organization' ? 'organization' : 'global';
    const level = ['info', 'warning', 'critical'].includes(b.level) ? b.level : 'info';
    if (scope === 'organization' && !b.organizationId) {
      return NextResponse.json({ error: 'organizationId is required for organization scope' }, { status: 400 });
    }

    const created = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO platform_announcements (scope, organization_id, title, body, level, ends_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [scope, scope === 'organization' ? b.organizationId : null, title, b.body ?? null, level,
         b.endsAt ? new Date(b.endsAt).toISOString() : null, actor.email]
      );
      await logAudit(client, actor.email, 'announcement.create', 'announcement', res.rows[0].id, { title, scope, level });
      return res.rows[0];
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
