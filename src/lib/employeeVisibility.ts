/**
 * Row-level security for employee records.
 *
 * - HR / Admin (tier ≤ 6): all employees.
 * - Manager roles (Director/Manager/Team Lead): self + reporting hierarchy.
 * - Everyone else: only their own record (others via the public directory).
 *
 * `employees.manager` holds the manager's email, so hierarchy is resolved by
 * email with a recursive CTE (mirrors the leave module).
 */
import type { AuthedActor } from '@/lib/apiAuth';

const MANAGER_ROLES = ['Director', 'Manager', 'Team Lead'];

export function isHrScope(actor: AuthedActor): boolean {
  return actor.tier <= 6;
}
export function isManagerScope(actor: AuthedActor): boolean {
  return MANAGER_ROLES.includes(actor.role);
}

/**
 * Returns the set of employee IDs the actor may see in the FULL (management)
 * view, or `null` meaning "all employees" (HR scope).
 */
export async function getManageableEmployeeIds(
  client: any,
  actor: AuthedActor
): Promise<string[] | null> {
  if (isHrScope(actor)) return null; // all

  if (isManagerScope(actor)) {
    const r = await client.query(
      `
      WITH RECURSIVE hier AS (
        SELECT id, email FROM employees WHERE LOWER(email) = LOWER($1)
        UNION ALL
        SELECT e.id, e.email
        FROM employees e
        JOIN hier h ON LOWER(e.manager) = LOWER(h.email)
      )
      SELECT id FROM hier
      `,
      [actor.email]
    );
    return r.rows.map((x: any) => x.id);
  }

  // Plain employee: only self.
  if (actor.employeeId) return [actor.employeeId];
  const r = await client.query(`SELECT id FROM employees WHERE LOWER(email) = LOWER($1)`, [actor.email]);
  return r.rows.map((x: any) => x.id);
}

/** Whether the actor may view a specific employee's (filtered) record. */
export async function canViewEmployee(
  client: any,
  actor: AuthedActor,
  employeeRow: { id: string; email?: string; manager?: string }
): Promise<{ allowed: boolean; isSelf: boolean; isManager: boolean }> {
  const isSelf =
    (!!actor.employeeId && actor.employeeId === employeeRow.id) ||
    (!!employeeRow.email && employeeRow.email.toLowerCase() === actor.email.toLowerCase());

  if (isHrScope(actor)) return { allowed: true, isSelf, isManager: false };
  if (isSelf) return { allowed: true, isSelf: true, isManager: false };

  // Manager check: is this employee in the actor's reporting hierarchy?
  let isManager = false;
  if (isManagerScope(actor)) {
    const r = await client.query(
      `
      WITH RECURSIVE hier AS (
        SELECT id, email FROM employees WHERE LOWER(manager) = LOWER($1)
        UNION ALL
        SELECT e.id, e.email
        FROM employees e
        JOIN hier h ON LOWER(e.manager) = LOWER(h.email)
      )
      SELECT 1 FROM hier WHERE id = $2 LIMIT 1
      `,
      [actor.email, employeeRow.id]
    );
    isManager = r.rows.length > 0;
  }

  return { allowed: isManager, isSelf: false, isManager };
}
