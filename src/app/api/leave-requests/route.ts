import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, buildVisibilityClause, isHROrAbove, writeAuditLog } from '@/lib/leavePermissions';
import { notifyLeaveSubmitted } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    // ── Auth + visibility ──────────────────────────────────────────────────
    const actor = await getActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page   = parseInt(searchParams.get('page')  || '1');
    const limit  = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const { clause: visClause, params: visParams } = await buildVisibilityClause(actor, 0);

    const result = await withPgClient(async (client) => {
      // Build WHERE fragments
      const conditions: string[] = [];
      const values: any[] = [...visParams];

      if (status) {
        values.push(status);
        conditions.push(`status = $${values.length}`);
      }

      // Merge visibility clause (already prefixed with AND) into a standalone condition
      const whereBase = visClause.startsWith('AND ')
        ? visClause.slice(4)       // strip leading 'AND '
        : visClause || 'TRUE';

      const extraCond = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
      const whereSQL  = `WHERE ${whereBase}${extraCond}`;

      const countSQL = `SELECT COUNT(*) FROM leave_requests ${whereSQL}`;
      const dataSQL  = `SELECT * FROM leave_requests ${whereSQL} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const [countRes, dataRes] = await Promise.all([
        client.query(countSQL, values),
        client.query(dataSQL,  values),
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
    // ── Auth ───────────────────────────────────────────────────────────────
    const actor = await getActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      // Resolve employee record
      let empRes;
      const targetEmail = employee_email || actor.email;

      if (employee_id) {
        empRes = await client.query('SELECT * FROM employees WHERE id = $1', [employee_id]);
      } else if (targetEmail) {
        empRes = await client.query('SELECT * FROM employees WHERE LOWER(email) = $1', [targetEmail.toLowerCase()]);
      }

      const emp = empRes?.rows[0];
      if (!emp) {
        throw new Error('Employee record not found. Please contact an HR administrator to set up your employee profile.');
      }

      // ── Ownership guard ────────────────────────────────────────────────
      // Non-HR users can only submit leave for themselves
      const isForSelf = emp.email?.toLowerCase() === actor.email;
      if (!isForSelf && !isHROrAbove(actor.role)) {
        throw new Error('You can only submit leave requests for yourself');
      }

      const empName        = employee_name || `${emp.first_name} ${emp.last_name}`;
      const initials       = ((emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')).toUpperCase() || '??';
      const departmentVal  = emp.department || 'Operations';

      const AVATAR_COLORS = [
        'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
        'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-rose-600',
        'bg-cyan-600', 'bg-orange-600',
      ];
      let hash = 0;
      const empIdStr = emp.emp_id || emp.id;
      for (let i = 0; i < empIdStr.length; i++) {
        hash = empIdStr.charCodeAt(i) + ((hash << 5) - hash);
      }
      const avatarColorVal = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
      const finalDaysCount = days_count || 1;

      const res = await client.query(
        `INSERT INTO leave_requests
           (employee_id, employee_name, employee_email, employee_initials, avatar_color,
            department, leave_type, days, days_count, start_date, end_date, reason, status,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',NOW(),NOW())
         RETURNING *`,
        [
          emp.id, empName, emp.email, initials, avatarColorVal,
          departmentVal, leave_type, finalDaysCount, finalDaysCount,
          start_date, end_date, reason || null,
        ]
      );

      const created = res.rows[0];

      // Notify manager + HR (best-effort)
      await notifyLeaveSubmitted(client, created, actor.email);

      // Audit log
      writeAuditLog(actor, 'submitted', created.id, null, created);

      return created;
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    const status = error.message.includes('only submit') ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
