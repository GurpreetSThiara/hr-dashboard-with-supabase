/**
 * GET /api/employees/[id]/history — the employee's audit trail.
 *
 * Visible to HR/Admin (full) and to the employee themselves (own history).
 * Managers may view history of employees in their reporting hierarchy.
 * Supports action filter + pagination.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError, ApiAuthError } from '@/lib/apiAuth';
import { canViewEmployee, isHrScope } from '@/lib/employeeVisibility';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action')?.trim();
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '25'));
    const offset = (page - 1) * limit;

    const result = await withPgClient(async (client) => {
      // Authorize against the target employee record.
      const empRes = await client.query('SELECT id, email, manager FROM employees WHERE id = $1', [id]);
      if (empRes.rows.length === 0) throw new ApiAuthError('Employee not found', 404);
      const vis = await canViewEmployee(client, actor, empRes.rows[0]);
      if (!vis.allowed) throw new ApiAuthError('Forbidden', 403);

      const conds = ['employee_id = $1'];
      const vals: any[] = [id];
      if (action) { vals.push(action); conds.push(`action = $${vals.length}`); }
      const where = `WHERE ${conds.join(' AND ')}`;

      const countRes = await client.query(`SELECT COUNT(*) FROM employee_audit_log ${where}`, vals);

      // Non-HR viewers (self / manager) do NOT see IP / user-agent forensic data.
      const forensicCols = isHrScope(actor) ? ', ip_address, user_agent' : '';
      const dataRes = await client.query(
        `SELECT id, employee_id, actor_email, actor_role, action,
                changed_fields, old_values, new_values, reason, created_at${forensicCols}
         FROM employee_audit_log ${where}
         ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        vals
      );

      return {
        data: dataRes.rows,
        pagination: {
          page, limit,
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
