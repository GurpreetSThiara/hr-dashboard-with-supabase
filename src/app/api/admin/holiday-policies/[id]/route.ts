import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/** PUT  /api/admin/holiday-policies/[id] */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, is_default, is_active } = await request.json();

    const row = await withPgClient(async (client) => {
      if (is_default) {
        await client.query(`UPDATE holiday_policies SET is_default = false`);
      }
      const res = await client.query(`
        UPDATE holiday_policies
        SET name        = COALESCE($1, name),
            description = COALESCE($2, description),
            is_default  = COALESCE($3, is_default),
            is_active   = COALESCE($4, is_active),
            updated_at  = NOW()
        WHERE id = $5
        RETURNING *
      `, [name||null, description||null, is_default??null, is_active??null, id]);
      if (res.rows.length === 0) throw new Error('Policy not found');
      return res.rows[0];
    });

    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE  /api/admin/holiday-policies/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await withPgClient(async (client) => {
      const res = await client.query(`DELETE FROM holiday_policies WHERE id = $1 RETURNING id`, [id]);
      if (res.rows.length === 0) throw new Error('Policy not found');
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * POST  /api/admin/holiday-policies/[id]/assign
 * Body: { assignment_type, assignment_value }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { assignment_type, assignment_value } = await request.json();
    if (!assignment_type || !assignment_value) {
      return NextResponse.json({ error: 'assignment_type and assignment_value are required' }, { status: 400 });
    }

    const row = await withPgClient(async (client) => {
      const res = await client.query(`
        INSERT INTO holiday_policy_assignments (policy_id, assignment_type, assignment_value, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (assignment_type, assignment_value) DO UPDATE
          SET policy_id = EXCLUDED.policy_id,
              created_by = EXCLUDED.created_by
        RETURNING *
      `, [id, assignment_type, assignment_value, actor.email]);
      return res.rows[0];
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
