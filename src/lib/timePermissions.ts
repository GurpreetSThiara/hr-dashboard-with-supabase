/**
 * Server-side visibility + approval enforcement for the Time Tracking module.
 *
 * Mirrors the leave-permissions approach: because every API route uses
 * `withPgClient` (connects as postgres, BYPASSES RLS), all filtering must happen
 * here in application code — RLS only guards direct anon/auth reads.
 *
 * Visibility model (no config table yet — derived from role/hierarchy):
 *   - HR-or-above           → all employees' time.
 *   - Everyone else         → own time + everyone in their downstream reporting
 *                             hierarchy (so managers see their teams).
 */
import { withPgClient } from '@/lib/pgClient';
import { type ActorContext, isHROrAbove } from '@/lib/leavePermissions';

/**
 * Resolve the set of employee emails (lowercased) whose time the actor may see.
 * Returns null to mean "all" (no filtering).
 */
export async function getVisibleTimeEmails(actor: ActorContext): Promise<string[] | null> {
  if (isHROrAbove(actor.role)) return null;
  return withPgClient(async (client) => {
    const r = await client.query(
      `
      WITH RECURSIVE hier AS (
        SELECT id, email FROM employees WHERE LOWER(email) = $1
        UNION ALL
        SELECT e.id, e.email
        FROM employees e
        JOIN hier h ON LOWER(e.manager) = LOWER(h.email)
      )
      SELECT DISTINCT LOWER(email) AS email FROM hier WHERE email IS NOT NULL
      `,
      [actor.email.toLowerCase()]
    );
    const emails = r.rows.map((x: any) => x.email);
    // Always include the actor themselves even if not in the employees table.
    if (!emails.includes(actor.email.toLowerCase())) emails.push(actor.email.toLowerCase());
    return emails;
  });
}

/**
 * Build a parameterized WHERE fragment restricting a query to time rows the
 * actor can see, filtering on a lowercased email column (default
 * `employee_email`). Returns a clause already prefixed with `AND`.
 */
export async function buildTimeVisibilityClause(
  actor: ActorContext,
  existingParamCount = 0,
  emailColumn = 'employee_email'
): Promise<{ clause: string; params: any[] }> {
  const emails = await getVisibleTimeEmails(actor);
  if (emails === null) return { clause: '', params: [] };
  if (emails.length === 0) return { clause: 'AND false', params: [] };
  return {
    clause: `AND LOWER(${emailColumn}) = ANY($${existingParamCount + 1}::text[])`,
    params: [emails],
  };
}

/** Whether the actor may approve/reject a timesheet for the given owner email. */
export async function canApproveTimeFor(
  actor: ActorContext,
  ownerEmail: string
): Promise<boolean> {
  const owner = (ownerEmail || '').toLowerCase();
  if (!owner) return false;
  // No self-approval.
  if (owner === actor.email.toLowerCase()) return false;
  if (isHROrAbove(actor.role)) return true;
  const emails = await getVisibleTimeEmails(actor);
  if (emails === null) return true;
  return emails.includes(owner);
}
