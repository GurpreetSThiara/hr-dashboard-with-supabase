import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, requirePermission, authError, ApiAuthError } from '@/lib/apiAuth';
import { filterEmployeeForActor, isHrFieldViewer } from '@/lib/employeeFields';
import { canViewEmployee } from '@/lib/employeeVisibility';
import { writeEmployeeAudit, diffRows } from '@/lib/employeeAudit';

// Fields a plain employee may edit on their OWN record (self-service).
const SELF_EDITABLE_FIELDS = ['location'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { id } = await params;

    const data = await withPgClient(async (client) => {
      const res = await client.query('SELECT * FROM employees WHERE id = $1', [id]);
      if (res.rows.length === 0) throw new ApiAuthError('Employee not found', 404);
      const row = res.rows[0];

      const vis = await canViewEmployee(client, actor, row);
      if (!vis.allowed) throw new ApiAuthError('Forbidden', 403);

      return filterEmployeeForActor(row, actor, { isSelf: vis.isSelf, isManager: vis.isManager });
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const reason: string | null = body.reason ?? null;

    const updated = await withPgClient(async (client) => {
      const existingRes = await client.query('SELECT * FROM employees WHERE id = $1', [id]);
      if (existingRes.rows.length === 0) throw new ApiAuthError('Employee not found', 404);
      const before = existingRes.rows[0];

      const hr = isHrFieldViewer(actor);
      const isSelf =
        (!!actor.employeeId && actor.employeeId === id) ||
        before.email?.toLowerCase() === actor.email.toLowerCase();

      // Determine which fields this actor may write.
      let writable: string[];
      if (hr) {
        writable = [
          'first_name', 'last_name', 'email', 'department', 'designation',
          'employment_type', 'manager', 'join_date', 'status',
          'salary_band', 'location', 'attendance_pct',
        ];
      } else if (isSelf) {
        writable = SELF_EDITABLE_FIELDS;
      } else {
        throw new ApiAuthError('You do not have permission to edit this employee', 403);
      }

      const updates: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      for (const key of writable) {
        if (key in body) {
          updates.push(`${key} = $${idx++}`);
          vals.push(body[key]);
        }
      }
      if (updates.length === 0) throw new ApiAuthError('No permitted fields to update', 400);
      updates.push('updated_at = NOW()');
      vals.push(id);

      const res = await client.query(
        `UPDATE employees SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        vals
      );
      const after = res.rows[0];

      const { changed, oldValues, newValues } = diffRows(before, after);
      if (changed.length > 0) {
        await writeEmployeeAudit(client, {
          employeeId: id,
          empId: after.emp_id,
          actor,
          action: 'updated',
          changed,
          oldValues,
          newValues,
          reason,
          request,
        });
      }

      return { after, isSelf };
    });

    // Return a field-filtered view consistent with the actor's rights.
    const filtered = filterEmployeeForActor(updated.after, actor, {
      isSelf: updated.isSelf,
      isManager: false,
    });
    return NextResponse.json(filtered);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** Soft delete — preserves the record + history. Requires manage_employees. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePermission(request, 'manage_employees');
    const { id } = await params;
    let reason: string | null = null;
    try { reason = (await request.json())?.reason ?? null; } catch { /* no body */ }

    await withPgClient(async (client) => {
      const existing = await client.query('SELECT * FROM employees WHERE id = $1', [id]);
      if (existing.rows.length === 0) throw new ApiAuthError('Employee not found', 404);
      const before = existing.rows[0];
      if (before.deleted_at) throw new ApiAuthError('Employee is already deleted', 409);

      const res = await client.query(
        `UPDATE employees
         SET deleted_at = NOW(), deleted_by = $1, deleted_reason = $2,
             status = 'terminated', updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [actor.email, reason, id]
      );

      await writeEmployeeAudit(client, {
        employeeId: id,
        empId: before.emp_id,
        actor,
        action: 'deleted',
        oldValues: { status: before.status, deleted_at: null },
        newValues: { status: 'terminated', deleted_at: res.rows[0].deleted_at },
        reason,
        request,
      });
    });

    return NextResponse.json({ success: true, softDeleted: true });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
