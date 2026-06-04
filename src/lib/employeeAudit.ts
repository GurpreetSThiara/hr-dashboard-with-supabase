/**
 * Employee audit-trail helper.
 *
 * Records every create / update / soft-delete / restore on the employees table
 * with actor, timestamp, field-level diff, IP, and user-agent. Specific
 * high-sensitivity changes (role, salary, department, manager, status) are
 * tagged with a dedicated action so they can be filtered in the History tab.
 *
 * Designed to be called inside an existing `withPgClient` transaction (it
 * receives the `client`) and to never throw — auditing must not break the
 * primary operation.
 */
import type { NextRequest } from 'next/server';
import type { AuthedActor } from '@/lib/apiAuth';

export type EmployeeAuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'role_change'
  | 'salary_change'
  | 'department_change'
  | 'manager_change'
  | 'status_change';

// Fields whose change should be promoted to a dedicated action type.
const SENSITIVE_CHANGE_ACTION: Record<string, EmployeeAuditAction> = {
  salary_band: 'salary_change',
  department: 'department_change',
  manager: 'manager_change',
  status: 'status_change',
};

export function getClientMeta(request: NextRequest): { ip: string | null; userAgent: string | null } {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;
  const userAgent = request.headers.get('user-agent') || null;
  return { ip, userAgent };
}

/** Compute the changed fields + old/new value maps between two rows. */
export function diffRows(
  oldRow: Record<string, any> | null,
  newRow: Record<string, any> | null,
  ignore: string[] = ['updated_at', 'created_at']
): { changed: string[]; oldValues: Record<string, any>; newValues: Record<string, any> } {
  const changed: string[] = [];
  const oldValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};
  const keys = new Set<string>([
    ...Object.keys(oldRow || {}),
    ...Object.keys(newRow || {}),
  ]);
  for (const k of keys) {
    if (ignore.includes(k)) continue;
    const a = oldRow ? oldRow[k] : undefined;
    const b = newRow ? newRow[k] : undefined;
    const aN = a instanceof Date ? a.toISOString() : a;
    const bN = b instanceof Date ? b.toISOString() : b;
    if (JSON.stringify(aN) !== JSON.stringify(bN)) {
      changed.push(k);
      oldValues[k] = aN ?? null;
      newValues[k] = bN ?? null;
    }
  }
  return { changed, oldValues, newValues };
}

interface WriteAuditArgs {
  employeeId: string | null;
  empId?: string | null;
  actor: AuthedActor;
  action: EmployeeAuditAction;
  changed?: string[];
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  reason?: string | null;
  request?: NextRequest;
}

/**
 * Insert one audit row. Best-effort: logs and swallows errors.
 * If the change set includes a sensitive field, an additional tagged row is
 * also written so salary/role/etc. changes are independently queryable.
 */
export async function writeEmployeeAudit(client: any, args: WriteAuditArgs): Promise<void> {
  const { employeeId, empId, actor, action, changed = [], oldValues = null, newValues = null, reason = null, request } = args;
  const meta = request ? getClientMeta(request) : { ip: null, userAgent: null };

  try {
    await client.query(
      `INSERT INTO employee_audit_log
         (employee_id, employee_emp_id, actor_email, actor_role, action,
          changed_fields, old_values, new_values, reason, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        employeeId,
        empId ?? null,
        actor.email,
        actor.role,
        action,
        changed.length ? changed : null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        reason,
        meta.ip,
        meta.userAgent,
      ]
    );

    // Promote sensitive single-field changes to their own tagged audit rows.
    if (action === 'updated') {
      for (const field of changed) {
        const tagged = SENSITIVE_CHANGE_ACTION[field];
        if (tagged) {
          await client.query(
            `INSERT INTO employee_audit_log
               (employee_id, employee_emp_id, actor_email, actor_role, action,
                changed_fields, old_values, new_values, reason, ip_address, user_agent)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              employeeId, empId ?? null, actor.email, actor.role, tagged,
              [field],
              JSON.stringify({ [field]: oldValues?.[field] ?? null }),
              JSON.stringify({ [field]: newValues?.[field] ?? null }),
              reason, meta.ip, meta.userAgent,
            ]
          );
        }
      }
    }
  } catch (err) {
    console.error('[employeeAudit] write failed (non-fatal):', (err as Error).message);
  }
}
