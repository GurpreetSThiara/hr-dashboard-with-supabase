import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import {
  getActorFromRequest,
  canActorApproveLeave,
  isHROrAbove,
  writeAuditLog,
} from '@/lib/leavePermissions';
import { notifyLeaveDecision, notifyLeaveCancelled } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Auth ───────────────────────────────────────────────────────────────
    const actor = await getActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, approver_notes } = body;

    if (!['approved', 'rejected', 'cancelled'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const data = await withPgClient(async (client) => {
      // Load existing leave
      const existing = await client.query(
        'SELECT * FROM leave_requests WHERE id = $1',
        [id]
      );
      if (existing.rows.length === 0) throw new Error('Leave request not found');
      const leave = existing.rows[0];

      // ── Self-approval / self-cancel guard ──────────────────────────────
      if (actor.email && leave.employee_email) {
        const isSelf = actor.email.toLowerCase() === leave.employee_email.toLowerCase();
        if (isSelf && (action === 'approved' || action === 'rejected')) {
          throw new Error('You cannot approve or reject your own leave request');
        }
        if (isSelf && action === 'cancelled') {
          throw new Error(
            'You cannot cancel your own leave request from this panel. Use "Cancel Request" on your dashboard instead.'
          );
        }
      }

      // ── Approval authority check ───────────────────────────────────────
      if (action === 'approved' || action === 'rejected') {
        const check = await canActorApproveLeave(actor, {
          id: leave.id,
          employee_id:    leave.employee_id,
          employee_email: leave.employee_email,
        });
        if (!check.allowed) {
          throw new Error(check.reason || 'You are not authorised to approve this leave');
        }
      }

      // Cancel requires HR-or-above (managers do not cancel)
      if (action === 'cancelled' && !isHROrAbove(actor.role)) {
        throw new Error('Only HR / Admin can cancel approved leaves');
      }

      // ── Status transition guards ───────────────────────────────────────
      if (action === 'cancelled' && leave.status !== 'approved') {
        throw new Error(
          `Cannot cancel a leave that is currently "${leave.status}". Only approved leaves can be cancelled.`
        );
      }
      if ((action === 'approved' || action === 'rejected') && leave.status !== 'pending') {
        throw new Error(
          `Cannot ${action} a leave that is already "${leave.status}".`
        );
      }

      const res = await client.query(
        `UPDATE leave_requests
         SET status        = $1,
             approver_notes = $2,
             approver_email = $3,
             approved_at   = NOW(),
             updated_at    = NOW()
         WHERE id = $4
         RETURNING *`,
        [action, approver_notes || null, actor.email, id]
      );

      const updated = res.rows[0];

      // Audit log
      writeAuditLog(actor, action, id, { status: leave.status }, { status: action });

      // Notifications (best-effort)
      if (action === 'cancelled') {
        await notifyLeaveCancelled(client, updated, actor.email);
      } else {
        await notifyLeaveDecision(client, updated);
      }

      return updated;
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const isAuthError =
      error.message.toLowerCase().includes('cannot approve') ||
      error.message.toLowerCase().includes('cannot reject') ||
      error.message.toLowerCase().includes('cannot cancel') ||
      error.message.toLowerCase().includes('not authorised') ||
      error.message.toLowerCase().includes('not authorized') ||
      error.message.toLowerCase().includes('only hr');

    return NextResponse.json(
      { error: error.message },
      { status: isAuthError ? 403 : 400 }
    );
  }
}
