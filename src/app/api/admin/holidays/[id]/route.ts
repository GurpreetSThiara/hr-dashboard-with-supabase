import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/** PUT  /api/admin/holidays/[id] — update a holiday */
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

    const body = await request.json();
    const { name, date, holiday_type, description, is_recurring, country_code, region, policy_ids } = body;

    const row = await withPgClient(async (client) => {
      const res = await client.query(`
        UPDATE company_holidays
        SET name         = COALESCE($1, name),
            date         = COALESCE($2, date),
            holiday_type = COALESCE($3, holiday_type),
            description  = COALESCE($4, description),
            is_recurring = COALESCE($5, is_recurring),
            country_code = COALESCE($6, country_code),
            region       = COALESCE($7, region),
            updated_at   = NOW()
        WHERE id = $8
        RETURNING *
      `, [name||null, date||null, holiday_type||null, description||null,
          is_recurring??null, country_code||null, region||null, id]);

      if (res.rows.length === 0) throw new Error('Holiday not found');
      const h = res.rows[0];

      // Update policy links if provided
      if (Array.isArray(policy_ids)) {
        await client.query(`DELETE FROM holiday_policy_holidays WHERE holiday_id = $1`, [id]);
        for (const pid of policy_ids) {
          await client.query(
            `INSERT INTO holiday_policy_holidays (policy_id, holiday_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [pid, id]
          );
        }
      }

      return h;
    });

    return NextResponse.json(row);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/** DELETE  /api/admin/holidays/[id] — archive a holiday (soft delete) */
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

    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    await withPgClient(async (client) => {
      if (hard) {
        const res = await client.query(`DELETE FROM company_holidays WHERE id = $1 RETURNING id`, [id]);
        if (res.rows.length === 0) throw new Error('Holiday not found');
      } else {
        const res = await client.query(
          `UPDATE company_holidays SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING id`,
          [id]
        );
        if (res.rows.length === 0) throw new Error('Holiday not found');
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/** PATCH  /api/admin/holidays/[id] — restore an archived holiday */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE company_holidays SET is_archived = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      if (res.rows.length === 0) throw new Error('Holiday not found');
      return res.rows[0];
    });

    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
