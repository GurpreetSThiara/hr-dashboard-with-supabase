/**
 * Server-side leave permission enforcement.
 *
 * All API routes that touch leave_requests must go through these helpers
 * instead of querying the DB directly — this is the single enforcement point
 * for visibility and approval authority.
 *
 * Architecture note: because every API route uses `withPgClient` (which
 * connects as postgres and BYPASSES RLS), RLS alone cannot protect leave
 * data. All filtering must happen here, in application code.
 */

import { NextRequest } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase, getServerUser } from '@/lib/supabase/server';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActorContext {
  userId: string;
  email: string;
  role: string;
  employeeId: string | null;
  /** Tenant the actor belongs to. NULL means a platform-level Super Owner. */
  organizationId: string | null;
  /** True for the global Super Owner (tier 0, belongs to no organization). */
  isSuperOwner: boolean;
}

export type VisibilityScope = 'self' | 'direct_reports' | 'full_hierarchy' | 'department' | 'all';
export type ApprovalScope   = 'none' | 'direct_reports' | 'full_hierarchy' | 'all';

// ── Extract actor from request ───────────────────────────────────────────────

/**
 * Authenticates the request and resolves the actor's role + employee ID.
 * Returns null if no valid session.
 */
export async function getActorFromRequest(
  request: NextRequest
): Promise<ActorContext | null> {
  const conn = getServerSupabase();
  if (!conn) return null;

  const user = await getServerUser(request, conn.client);
  if (!user) return null;

  const email = (user.email ?? '').toLowerCase();

  return withPgClient(async (client) => {
    const res = await client.query(
      `SELECT u.role, u.organization_id, e.id AS employee_id
       FROM users u
       LEFT JOIN employees e
         ON LOWER(e.email) = LOWER(u.email)
        AND e.organization_id = u.organization_id
       WHERE u.id = $1`,
      [user.id]
    );
    const row = res.rows[0];
    const role = row?.role ?? 'Employee';
    return {
      userId: user.id,
      email,
      role,
      employeeId: row?.employee_id ?? null,
      organizationId: row?.organization_id ?? null,
      isSuperOwner: role === 'Super Owner',
    };
  });
}

// ── Visibility ───────────────────────────────────────────────────────────────

/**
 * Resolves the set of employee IDs the actor may see leave records for.
 * Returns null to mean "all employees" (no filtering needed).
 * Returns an empty array if the actor can see no one (unusual config).
 */
export async function getVisibleEmployeeIds(
  actor: ActorContext
): Promise<string[] | null> {
  return withPgClient(async (client) => {
    const cfgRes = await client.query(
      `SELECT scope FROM leave_visibility_config
       WHERE viewer_role = $1 AND is_active = true`,
      [actor.role]
    );
    const scope: VisibilityScope = cfgRes.rows[0]?.scope ?? 'self';

    if (scope === 'all') return null;

    if (scope === 'self') {
      if (actor.employeeId) return [actor.employeeId];
      const r = await client.query(
        `SELECT id FROM employees WHERE LOWER(email) = $1`, [actor.email]
      );
      return r.rows.map((x: any) => x.id);
    }

    if (scope === 'direct_reports') {
      const r = await client.query(
        `SELECT id FROM employees WHERE LOWER(manager) = $1 OR LOWER(email) = $1`,
        [actor.email]
      );
      return r.rows.map((x: any) => x.id);
    }

    if (scope === 'full_hierarchy') {
      // Recursive CTE: self + all downstream reportees
      const r = await client.query(`
        WITH RECURSIVE hier AS (
          SELECT id, email FROM employees WHERE LOWER(email) = $1
          UNION ALL
          SELECT e.id, e.email
          FROM employees e
          JOIN hier h ON LOWER(e.manager) = LOWER(h.email)
        )
        SELECT id FROM hier
      `, [actor.email]);
      return r.rows.map((x: any) => x.id);
    }

    if (scope === 'department') {
      const deptRes = await client.query(
        `SELECT department FROM employees WHERE LOWER(email) = $1`, [actor.email]
      );
      const dept = deptRes.rows[0]?.department;
      if (!dept) return [];
      const r = await client.query(
        `SELECT id FROM employees WHERE department = $1`, [dept]
      );
      return r.rows.map((x: any) => x.id);
    }

    return []; // unknown scope → fail-safe: see nothing
  });
}

/**
 * Builds a parameterized WHERE clause fragment that restricts a
 * `leave_requests` query to rows the actor can see.
 *
 * @param existingParamCount  number of $N params already in the query
 * @returns { clause, params } — append clause to WHERE and spread params
 *
 * Example:
 *   const { clause, params } = await buildVisibilityClause(actor, 0);
 *   const rows = await client.query(
 *     `SELECT * FROM leave_requests WHERE 1=1 ${clause} ORDER BY created_at DESC`,
 *     params
 *   );
 */
export async function buildVisibilityClause(
  actor: ActorContext,
  existingParamCount = 0
): Promise<{ clause: string; params: any[] }> {
  const ids = await getVisibleEmployeeIds(actor);
  if (ids === null) return { clause: '', params: [] }; // all
  if (ids.length === 0) return { clause: 'AND false', params: [] };
  return {
    clause: `AND employee_id = ANY($${existingParamCount + 1}::uuid[])`,
    params: [ids],
  };
}

// ── Approval authority ────────────────────────────────────────────────────────

export interface ApproveCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Returns whether the actor is permitted to approve/reject/cancel a leave.
 * Automatically resolves active delegation.
 */
export async function canActorApproveLeave(
  actor: ActorContext,
  leave: { id: string; employee_id: string; employee_email: string }
): Promise<ApproveCheckResult> {
  if (!leave.employee_id) {
    return { allowed: false, reason: 'Leave has no employee_id' };
  }

  // Always block self-approval
  if (actor.email === (leave.employee_email ?? '').toLowerCase()) {
    return { allowed: false, reason: 'You cannot approve your own leave request' };
  }

  return withPgClient(async (client) => {
    // Resolve effective actor — check for active delegation
    let effectiveEmail = actor.email;
    let effectiveRole  = actor.role;

    const delRes = await client.query(`
      SELECT d.delegator_email, u.role AS delegator_role
      FROM leave_approval_delegates d
      JOIN users u ON LOWER(u.email) = LOWER(d.delegator_email)
      WHERE LOWER(d.delegate_email) = $1
        AND d.is_active = true
        AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
      LIMIT 1
    `, [actor.email]);

    if (delRes.rows.length > 0) {
      effectiveEmail = delRes.rows[0].delegator_email.toLowerCase();
      effectiveRole  = delRes.rows[0].delegator_role;
    }

    // Load approval config for the effective role
    const cfgRes = await client.query(
      `SELECT scope FROM leave_approval_config
       WHERE approver_role = $1 AND is_active = true`,
      [effectiveRole]
    );
    const scope: ApprovalScope = cfgRes.rows[0]?.scope ?? 'none';

    if (scope === 'none') {
      return { allowed: false, reason: `Role "${effectiveRole}" is not configured to approve leaves` };
    }
    if (scope === 'all') {
      return { allowed: true };
    }

    if (scope === 'direct_reports') {
      const chk = await client.query(
        `SELECT 1 FROM employees WHERE id = $1 AND LOWER(manager) = $2`,
        [leave.employee_id, effectiveEmail]
      );
      return chk.rows.length > 0
        ? { allowed: true }
        : { allowed: false, reason: 'Employee is not a direct report' };
    }

    if (scope === 'full_hierarchy') {
      const chk = await client.query(`
        WITH RECURSIVE hier AS (
          SELECT id, email FROM employees WHERE LOWER(manager) = $2
          UNION ALL
          SELECT e.id, e.email
          FROM employees e
          JOIN hier h ON LOWER(e.manager) = LOWER(h.email)
        )
        SELECT 1 FROM hier WHERE id = $1
      `, [leave.employee_id, effectiveEmail]);
      return chk.rows.length > 0
        ? { allowed: true }
        : { allowed: false, reason: 'Employee is not in your reporting hierarchy' };
    }

    return { allowed: false, reason: 'Unknown approval scope' };
  });
}

// ── Ownership checks ─────────────────────────────────────────────────────────

/** Returns whether the actor owns this leave (is the leave's employee) */
export async function isLeaveOwner(
  actor: ActorContext,
  leaveEmployeeId: string
): Promise<boolean> {
  if (!actor.employeeId) {
    return withPgClient(async (client) => {
      const r = await client.query(
        `SELECT 1 FROM employees WHERE id = $1 AND LOWER(email) = $2`,
        [leaveEmployeeId, actor.email]
      );
      return r.rows.length > 0;
    });
  }
  return actor.employeeId === leaveEmployeeId;
}

/** True if role can perform admin-level leave operations (cancel, edit any) */
export function isHROrAbove(role: string): boolean {
  return [
    'Super Admin', 'Owner', 'Admin',
    'HR Admin', 'HR Manager', 'HR Executive',
    'Director', 'Manager',
  ].includes(role);
}

// ── Audit log ────────────────────────────────────────────────────────────────

/**
 * Writes an audit log entry. Best-effort — never throws, never blocks.
 */
export function writeAuditLog(
  actor: ActorContext | null,
  action: string,
  leaveRequestId?: string | null,
  oldValue?: any,
  newValue?: any
): void {
  withPgClient(async (client) => {
    await client.query(
      `INSERT INTO leave_audit_log
         (leave_request_id, actor_email, actor_role, action, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        leaveRequestId ?? null,
        actor?.email ?? null,
        actor?.role  ?? null,
        action,
        oldValue  != null ? JSON.stringify(oldValue)  : null,
        newValue  != null ? JSON.stringify(newValue)  : null,
      ]
    );
  }).catch((err) => {
    console.error('[AuditLog] write failed (non-fatal):', err);
  });
}
