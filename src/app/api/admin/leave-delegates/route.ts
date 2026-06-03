import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/** GET  /api/admin/leave-delegates  — list active delegations */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `SELECT id, delegator_email, delegate_email, start_date, end_date,
                is_active, created_by, created_at
         FROM leave_approval_delegates
         ORDER BY created_at DESC`
      );
      return res.rows;
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST  /api/admin/leave-delegates
 * Body: { delegator_email, delegate_email, start_date, end_date }
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { delegator_email, delegate_email, start_date, end_date } = body;

    if (!delegator_email || !delegate_email || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'delegator_email, delegate_email, start_date, end_date are required' },
        { status: 400 }
      );
    }

    if (delegator_email.toLowerCase() === delegate_email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Delegator and delegate cannot be the same person' },
        { status: 400 }
      );
    }

    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO leave_approval_delegates
           (delegator_email, delegate_email, start_date, end_date, is_active, created_by)
         VALUES ($1, $2, $3, $4, true, $5)
         RETURNING *`,
        [
          delegator_email.toLowerCase(),
          delegate_email.toLowerCase(),
          start_date,
          end_date,
          actor.email,
        ]
      );
      return res.rows[0];
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
