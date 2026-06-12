import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest, isHROrAbove, getVisibleEmployeeIds } from '@/lib/leavePermissions';
import type { ActorContext } from '@/lib/leavePermissions';

/**
 * GET  /api/admin/leave-permissions-preview?email=...
 *
 * Returns the effective visibility scope and the list of employee IDs that
 * the given user (identified by email) would be able to see.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor || !isHROrAbove(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const email = request.nextUrl.searchParams.get('email')?.toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'email query param required' }, { status: 400 });
    }

    const data = await withPgClient(async (client) => {
      // Resolve user row
      const userRes = await client.query(
        `SELECT u.id, u.role, u.organization_id, e.id AS employee_id
         FROM users u
         LEFT JOIN employees e ON LOWER(e.email) = LOWER(u.email)
         WHERE LOWER(u.email) = $1`,
        [email]
      );
      const userRow = userRes.rows[0];
      if (!userRow) throw new Error(`No user found with email "${email}"`);

      const targetActor: ActorContext = {
        userId:     userRow.id,
        email,
        role:       userRow.role ?? 'Employee',
        employeeId: userRow.employee_id ?? null,
        organizationId: userRow.organization_id ?? null,
        isSuperOwner: (userRow.role ?? 'Employee') === 'Super Owner',
      };

      // Visibility scope
      const visCfgRes = await client.query(
        `SELECT scope FROM leave_visibility_config WHERE viewer_role = $1 AND is_active = true`,
        [targetActor.role]
      );
      const visScope = visCfgRes.rows[0]?.scope ?? 'self';

      // Approval scope
      const appCfgRes = await client.query(
        `SELECT scope FROM leave_approval_config WHERE approver_role = $1 AND is_active = true`,
        [targetActor.role]
      );
      const approvalScope = appCfgRes.rows[0]?.scope ?? 'none';

      // Active delegations where this person is the delegate
      const delRes = await client.query(
        `SELECT d.delegator_email, u.role AS delegator_role
         FROM leave_approval_delegates d
         JOIN users u ON LOWER(u.email) = LOWER(d.delegator_email)
         WHERE LOWER(d.delegate_email) = $1
           AND d.is_active = true
           AND CURRENT_DATE BETWEEN d.start_date AND d.end_date`,
        [email]
      );
      const activeDelegations = delRes.rows;

      // Visible employee IDs
      const visibleIds = await getVisibleEmployeeIds(targetActor);

      // Resolve visible employee names for display
      let visibleEmployees: Array<{ id: string; name: string; email: string }> = [];
      if (visibleIds === null) {
        const empRes = await client.query(
          `SELECT id, first_name, last_name, email FROM employees ORDER BY first_name`
        );
        visibleEmployees = empRes.rows.map((r: any) => ({
          id:    r.id,
          name:  `${r.first_name} ${r.last_name}`.trim(),
          email: r.email,
        }));
      } else if (visibleIds.length > 0) {
        const empRes = await client.query(
          `SELECT id, first_name, last_name, email FROM employees WHERE id = ANY($1::uuid[]) ORDER BY first_name`,
          [visibleIds]
        );
        visibleEmployees = empRes.rows.map((r: any) => ({
          id:    r.id,
          name:  `${r.first_name} ${r.last_name}`.trim(),
          email: r.email,
        }));
      }

      return {
        email,
        role:              targetActor.role,
        visibilityScope:   visScope,
        approvalScope,
        activeDelegations,
        totalVisible:      visibleIds === null ? 'all' : visibleIds.length,
        visibleEmployees:  visibleIds === null ? visibleEmployees.slice(0, 20) : visibleEmployees,
        visibleTruncated:  visibleIds === null && visibleEmployees.length >= 20,
      };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    const status = err.message.includes('No user') ? 404 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
