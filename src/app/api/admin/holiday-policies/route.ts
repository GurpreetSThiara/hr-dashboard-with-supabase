import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/** GET  /api/admin/holiday-policies — list all policies */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT hp.*,
               COUNT(DISTINCT hph.holiday_id)::int AS holiday_count,
               COUNT(DISTINCT hpa.id)::int          AS assignment_count
        FROM   holiday_policies hp
        LEFT JOIN holiday_policy_holidays     hph ON hph.policy_id = hp.id
        LEFT JOIN holiday_policy_assignments  hpa ON hpa.policy_id = hp.id
        GROUP BY hp.id
        ORDER BY hp.is_default DESC, hp.name
      `);
      return res.rows;
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST  /api/admin/holiday-policies — create a policy */
export async function POST(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, is_default = false } = await request.json();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const row = await withPgClient(async (client) => {
      // If setting as default, unset all others first
      if (is_default) {
        await client.query(`UPDATE holiday_policies SET is_default = false`);
      }
      const res = await client.query(`
        INSERT INTO holiday_policies (name, description, is_default, created_by)
        VALUES ($1, $2, $3, $4) RETURNING *
      `, [name, description || null, is_default, actor.email]);
      return res.rows[0];
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    const dup = err.message?.includes('unique');
    return NextResponse.json({ error: dup ? 'Policy name already exists' : err.message },
      { status: dup ? 409 : 500 });
  }
}
