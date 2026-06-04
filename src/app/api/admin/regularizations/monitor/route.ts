/**
 * GET /api/admin/regularizations/monitor
 *
 * Workflow monitoring metrics for the approval dashboard. Reporting-scoped:
 * HR sees org-wide; managers see their hierarchy.
 *
 * Returns:
 *  - pending:        count of pending requests
 *  - stuck:          pending for > SLA_DAYS (default 3) — breaching SLA
 *  - approvedTotal / rejectedTotal
 *  - avgApprovalHours: mean time from created→decided over decided requests
 *  - oldestPendingDays
 *  - slaDays: the SLA threshold used
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, authError, ApiAuthError } from '@/lib/apiAuth';
import { getManageableEmployeeIds, isHrScope, isManagerScope } from '@/lib/employeeVisibility';

const SLA_DAYS = 3;

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    if (!isHrScope(actor) && !isManagerScope(actor)) {
      throw new ApiAuthError('Forbidden: you do not manage any team', 403);
    }

    const data = await withPgClient(async (client) => {
      const ids = await getManageableEmployeeIds(client, actor);

      const scope: string[] = [];
      const vals: any[] = [];
      if (ids !== null) {
        if (ids.length === 0) {
          return {
            pending: 0, stuck: 0, approvedTotal: 0, rejectedTotal: 0,
            avgApprovalHours: 0, oldestPendingDays: 0, slaDays: SLA_DAYS,
          };
        }
        vals.push(ids);
        scope.push(`employee_id = ANY($${vals.length}::uuid[])`);
      }
      const scopeSql = scope.length ? `WHERE ${scope.join(' AND ')}` : '';

      const res = await client.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'pending'
                            AND created_at < NOW() - INTERVAL '${SLA_DAYS} days')::int AS stuck,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_total,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_total,
          COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600.0)
                   FILTER (WHERE status IN ('approved','rejected')), 0) AS avg_approval_hours,
          COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0)
                   FILTER (WHERE status = 'pending'), 0) AS oldest_pending_days
        FROM attendance_regularizations
        ${scopeSql}
        `,
        vals
      );

      const r = res.rows[0];
      return {
        pending: r.pending,
        stuck: r.stuck,
        approvedTotal: r.approved_total,
        rejectedTotal: r.rejected_total,
        avgApprovalHours: Math.round(Number(r.avg_approval_hours) * 10) / 10,
        oldestPendingDays: Math.round(Number(r.oldest_pending_days) * 10) / 10,
        slaDays: SLA_DAYS,
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
