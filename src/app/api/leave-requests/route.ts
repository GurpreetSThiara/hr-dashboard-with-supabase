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
      // ── Overlap check (application-level, before DB trigger fires) ────────
      // Gives a richer error message pointing to the conflicting leave.
      const targetEmail2 = employee_email || actor.email;
      let checkEmpId: string | null = employee_id || null;
      if (!checkEmpId && targetEmail2) {
        const r = await client.query(
          `SELECT id FROM employees WHERE LOWER(email) = $1`,
          [targetEmail2.toLowerCase()]
        );
        checkEmpId = r.rows[0]?.id ?? null;
      }

      if (checkEmpId) {
        const conflict = await client.query(`
          SELECT id, leave_type, start_date, end_date, status
          FROM   leave_requests
          WHERE  employee_id = $1
            AND  status IN ('pending','approved')
            AND  start_date <= $3
            AND  end_date   >= $2
          LIMIT 1
        `, [checkEmpId, start_date, end_date]);

        if (conflict.rows.length > 0) {
          const c = conflict.rows[0];
          const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          throw new Error(
            `Overlapping leave: you already have a ${c.status} ${c.leave_type} leave ` +
            `from ${fmt(c.start_date)} to ${fmt(c.end_date)}. ` +
            `Please choose different dates or cancel the existing request first.`
          );
        }
      }

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

      // ── Server-side balance validation ─────────────────────────────────
      if (days_count) {
        const balRes = await client.query(`
          SELECT
            COALESCE(lpr.days_per_year, lp.days_per_year, 0) AS days_per_year,
            COALESCE(
              SUM(CASE WHEN lr.status = 'approved'
                        AND EXTRACT(YEAR FROM lr.start_date) = $3
                   THEN lr.days_count ELSE 0 END), 0
            )::int AS days_used
          FROM leave_types lt
          LEFT JOIN (
            SELECT r.leave_type_id, r.days_per_year
            FROM   leave_policy_rules r
            JOIN   leave_policy_versions v ON v.id = r.version_id AND v.is_active = true
          ) lpr ON lpr.leave_type_id = lt.id
          LEFT JOIN leave_policies lp ON lp.leave_type_id = lt.id
          LEFT JOIN leave_requests lr ON lr.employee_id = $1 AND lr.leave_type = lt.name
          WHERE lt.name = $2
          GROUP BY lpr.days_per_year, lp.days_per_year
        `, [emp.id, leave_type, new Date(start_date).getFullYear()]);

        const bal = balRes.rows[0];
        if (bal && bal.days_per_year > 0) {
          const remaining = Math.max(0, bal.days_per_year - bal.days_used);
          if (days_count > remaining) {
            throw new Error(
              `Insufficient leave balance. Requested ${days_count} day(s) but only ${remaining} remaining for ${leave_type}.`
            );
          }
        }
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

      // `days` is the legacy column (same value as days_count).
      // Keep them in sync until a future migration drops `days`.
      const res = await client.query(
        `INSERT INTO leave_requests
           (employee_id, employee_name, employee_email, employee_initials, avatar_color,
            department, leave_type, days, days_count, start_date, end_date, reason, status,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,'pending',NOW(),NOW())
         RETURNING *`,
        [
          emp.id, empName, emp.email, initials, avatarColorVal,
          departmentVal, leave_type, finalDaysCount,
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
    const msg = error.message || '';
    const status =
      msg.includes('only submit') ? 403 :
      msg.includes('Overlapping') || msg.includes('Leave conflict') ? 409 :
      msg.includes('Insufficient') ? 422 :
      500;
    return NextResponse.json({ error: msg }, { status });
  }
}
