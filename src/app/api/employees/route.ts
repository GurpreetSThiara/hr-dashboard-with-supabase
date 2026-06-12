import { NextRequest, NextResponse } from 'next/server';
import { withTenantPgClient } from '@/lib/pgClient';
import { requireAuth, requirePermission, requireModule, requireWritable, authError, ApiAuthError } from '@/lib/apiAuth';
import { filterEmployeeForActor } from '@/lib/employeeFields';
import { getManageableEmployeeIds, isHrScope, isManagerScope } from '@/lib/employeeVisibility';
import { writeEmployeeAudit } from '@/lib/employeeAudit';

/**
 * GET /api/employees — FULL management list (field-filtered + row-scoped).
 * HR/Admin see all; managers see their reporting hierarchy; plain employees are
 * directed to /api/employees/directory (403). Soft-deleted rows are excluded
 * unless ?includeDeleted=true and the caller is HR.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireModule(request, 'employees');

    if (!isHrScope(actor) && !isManagerScope(actor)) {
      throw new ApiAuthError('Use the employee directory for colleague info', 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const includeDeleted = searchParams.get('includeDeleted') === 'true' && isHrScope(actor);

    const result = await withTenantPgClient(actor.organizationId, async (client) => {
      const ids = await getManageableEmployeeIds(client, actor);

      const conds: string[] = [];
      const vals: any[] = [];
      // Tenant isolation: non-Super-Owner actors only ever see their own org.
      if (actor.organizationId) {
        vals.push(actor.organizationId);
        conds.push(`organization_id = $${vals.length}`);
      }
      if (!includeDeleted) conds.push('deleted_at IS NULL');
      if (ids !== null) {
        vals.push(ids);
        conds.push(`id = ANY($${vals.length}::uuid[])`);
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      const countRes = await client.query(`SELECT COUNT(*) FROM employees ${where}`, vals);
      const dataRes = await client.query(
        `SELECT * FROM employees ${where} ORDER BY emp_id ASC LIMIT ${limit} OFFSET ${offset}`,
        vals
      );

      const rows = dataRes.rows.map((row: any) =>
        filterEmployeeForActor(row, actor, {
          isSelf:
            (!!actor.employeeId && actor.employeeId === row.id) ||
            row.email?.toLowerCase() === actor.email.toLowerCase(),
          isManager: true,
        })
      );

      return {
        data: rows,
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
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** POST /api/employees — create (manage_employees) + audit. */
export async function POST(request: NextRequest) {
  try {
    // Permission-based: tier grant OR an additive permission-set grant.
    const actor = await requirePermission(request, 'manage_employees');
    await requireModule(request, 'employees');
    await requireWritable(request); // blocks suspended/expired/maintenance orgs
    if (!actor.organizationId) {
      throw new ApiAuthError('Cannot create employees without an organization context', 403);
    }

    // Seat limit enforcement (from the org's plan.limits.max_employees).
    const { computeOrgContext } = await import('@/lib/orgContext');
    const ctx = await computeOrgContext(actor.organizationId, false);
    if (ctx.seat.limit !== null && ctx.seat.used >= ctx.seat.limit) {
      throw new ApiAuthError(
        `Seat limit reached (${ctx.seat.used}/${ctx.seat.limit}) for the ${ctx.plan.name ?? 'current'} plan. Upgrade to add more employees.`,
        403
      );
    }

    const body = await request.json();

    const created = await withTenantPgClient(actor.organizationId, async (client) => {
      // Generate emp_id, scoped to this organization.
      const lastRes = await client.query(
        `SELECT emp_id FROM employees WHERE organization_id = $1 ORDER BY emp_id DESC LIMIT 1`,
        [actor.organizationId]
      );
      const lastId = lastRes.rows[0]?.emp_id || 'EMP-0000';
      const nextNum = parseInt(String(lastId).split('-')[1] || '0') + 1;
      const emp_id = `EMP-${String(nextNum).padStart(4, '0')}`;

      // Whitelist insertable columns
      const allowed = [
        'first_name', 'last_name', 'email', 'department', 'designation',
        'employment_type', 'manager', 'join_date', 'status',
        'salary_band', 'location', 'attendance_pct',
      ];
      // organization_id is server-derived (never from the request body).
      const cols = ['emp_id', 'organization_id'];
      const placeholders = ['$1', '$2'];
      const vals: any[] = [emp_id, actor.organizationId];
      for (const key of allowed) {
        if (key in body && body[key] !== undefined) {
          vals.push(body[key]);
          cols.push(key);
          placeholders.push(`$${vals.length}`);
        }
      }

      const res = await client.query(
        `INSERT INTO employees (${cols.join(', ')}, created_at, updated_at)
         VALUES (${placeholders.join(', ')}, NOW(), NOW())
         RETURNING *`,
        vals
      );
      const row = res.rows[0];

      await writeEmployeeAudit(client, {
        employeeId: row.id,
        empId: row.emp_id,
        actor,
        action: 'created',
        newValues: row,
        reason: body.reason ?? null,
        request,
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An employee with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
