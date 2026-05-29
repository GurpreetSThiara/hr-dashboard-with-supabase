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
    let sessionUserEmail: string | null = null;

    if (conn) {
      const { data: { session } } = await conn.client.auth.getSession();
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      sessionUserEmail = session.user.email ?? null;
    }

    const body = await request.json();
    const {
      employee_id, employee_name, employee_email, leave_type,
      start_date, end_date, reason, days_count,
    } = body;

    if (!leave_type || !start_date || !end_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = await withPgClient(async (client) => {
      // 1. Look up employee record to ensure all required fields are filled correctly
      let empRes;
      const targetEmail = employee_email || sessionUserEmail;

      if (employee_id) {
        empRes = await client.query('SELECT * FROM employees WHERE id = $1', [employee_id]);
      } else if (targetEmail) {
        empRes = await client.query('SELECT * FROM employees WHERE email = $1', [targetEmail]);
      }

      const emp = empRes?.rows[0];
      if (!emp) {
        throw new Error('Employee record not found. Please contact an HR administrator to set up your employee profile.');
      }

      const empName = employee_name || `${emp.first_name} ${emp.last_name}`;
      const initials = ((emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')).toUpperCase() || '??';
      const departmentVal = emp.department || 'Operations';
      
      // Calculate hash-based avatar color
      const AVATAR_COLORS = [
        'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
        'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-rose-600',
        'bg-cyan-600', 'bg-orange-600'
      ];
      let hash = 0;
      const empIdStr = emp.emp_id || emp.id;
      for (let i = 0; i < empIdStr.length; i++) {
        hash = empIdStr.charCodeAt(i) + ((hash << 5) - hash);
      }
      const avatarColorVal = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
      
      const finalDaysCount = days_count || 1;

      // 2. Insert the leave request into the database, populating both days and days_count
      const insertQuery = `
        INSERT INTO leave_requests
          (employee_id, employee_name, employee_email, employee_initials, avatar_color, department, leave_type, days, days_count, start_date, end_date, reason, status, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', NOW(), NOW())
        RETURNING *
      `;

      const res = await client.query(insertQuery, [
        emp.id,
        empName,
        emp.email,
        initials,
        avatarColorVal,
        departmentVal,
        leave_type,
        finalDaysCount,
        finalDaysCount,
        start_date,
        end_date,
        reason || null
      ]);

      return res.rows[0];
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
