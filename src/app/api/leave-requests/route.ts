import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const result = await withPgClient(async (client) => {
      let countText = 'SELECT COUNT(*) FROM leave_requests';
      let dataText = 'SELECT * FROM leave_requests';
      const values: any[] = [];

      if (status) {
        countText += ' WHERE status = $1';
        dataText  += ' WHERE status = $1';
        values.push(status);
      }

      dataText += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const [countRes, dataRes] = await Promise.all([
        client.query(countText, values),
        client.query(dataText, values),
      ]);

      return {
        data: dataRes.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countRes.rows[0].count),
          pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
        },
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const conn = getServerSupabase();
    let userEmail: string | null = null;

    if (conn) {
      const { data: { session } } = await conn.client.auth.getSession();
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userEmail = session.user.email ?? null;
    }

    const body = await request.json();
    const {
      employee_id, employee_name, employee_email, leave_type,
      start_date, end_date, reason, days_count,
    } = body;

    if (!employee_name || !leave_type || !start_date || !end_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO leave_requests
           (employee_id, employee_name, employee_email, leave_type, start_date, end_date,
            reason, days_count, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW(),NOW())
         RETURNING *`,
        [employee_id || null, employee_name, employee_email || userEmail || null,
         leave_type, start_date, end_date, reason || null, days_count || 1]
      );
      return res.rows[0];
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
