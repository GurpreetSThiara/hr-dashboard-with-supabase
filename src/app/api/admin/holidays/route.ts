import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove } from '@/lib/leavePermissions';

/** GET  /api/admin/holidays?year=YYYY&type=mandatory|optional&archived=true */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year     = searchParams.get('year');
    const type     = searchParams.get('type');
    const archived = searchParams.get('archived') === 'true';

    const rows = await withPgClient(async (client) => {
      const conds: string[] = [`ch.is_archived = $1`];
      const vals: any[] = [archived];

      if (year) { vals.push(parseInt(year)); conds.push(`ch.year = $${vals.length}`); }
      if (type) { vals.push(type);           conds.push(`ch.holiday_type = $${vals.length}`); }

      const res = await client.query(`
        SELECT ch.*,
               COALESCE(
                 json_agg(hp.name ORDER BY hp.name) FILTER (WHERE hp.id IS NOT NULL),
                 '[]'::json
               ) AS policy_names
        FROM   company_holidays ch
        LEFT JOIN holiday_policy_holidays hph ON hph.holiday_id = ch.id
        LEFT JOIN holiday_policies hp ON hp.id = hph.policy_id
        WHERE  ${conds.join(' AND ')}
        GROUP BY ch.id
        ORDER BY ch.date
      `, vals);

      return res.rows;
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST  /api/admin/holidays — create a holiday */
export async function POST(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, date, holiday_type = 'mandatory', description, is_recurring = false,
            country_code, region, policy_ids } = body;

    if (!name || !date) {
      return NextResponse.json({ error: 'name and date are required' }, { status: 400 });
    }

    const row = await withPgClient(async (client) => {
      const res = await client.query(`
        INSERT INTO company_holidays (name, date, holiday_type, description, is_recurring,
                                      country_code, region, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `, [name, date, holiday_type, description || null, is_recurring,
          country_code || null, region || null, actor.email]);

      const h = res.rows[0];

      // Link to policies if provided
      if (Array.isArray(policy_ids) && policy_ids.length > 0) {
        for (const pid of policy_ids) {
          await client.query(
            `INSERT INTO holiday_policy_holidays (policy_id, holiday_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [pid, h.id]
          );
        }
      }

      return h;
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    const dup = err.message?.includes('unique') || err.message?.includes('duplicate');
    return NextResponse.json({ error: dup ? 'A holiday on this date with this name already exists' : err.message },
      { status: dup ? 409 : 500 });
  }
}
