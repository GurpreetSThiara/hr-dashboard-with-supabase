/**
 * POST /api/employees/[id]/restore — restore a soft-deleted employee.
 * Requires manage_employees. Audited.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireManageEmployees, authError, ApiAuthError } from '@/lib/apiAuth';
import { writeEmployeeAudit } from '@/lib/employeeAudit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireManageEmployees(request);
    const { id } = await params;
    let reason: string | null = null;
    try { reason = (await request.json())?.reason ?? null; } catch { /* no body */ }

    const restored = await withPgClient(async (client) => {
      const existing = await client.query('SELECT * FROM employees WHERE id = $1', [id]);
      if (existing.rows.length === 0) throw new ApiAuthError('Employee not found', 404);
      const before = existing.rows[0];
      if (!before.deleted_at) throw new ApiAuthError('Employee is not deleted', 409);

      const res = await client.query(
        `UPDATE employees
         SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL,
             status = 'active', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      await writeEmployeeAudit(client, {
        employeeId: id,
        empId: before.emp_id,
        actor,
        action: 'restored',
        oldValues: { status: before.status, deleted_at: before.deleted_at },
        newValues: { status: 'active', deleted_at: null },
        reason,
        request,
      });

      return res.rows[0];
    });

    return NextResponse.json({ success: true, employee: restored });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
