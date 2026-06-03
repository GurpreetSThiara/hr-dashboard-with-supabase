import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase, getServerUser } from '@/lib/supabase/server';
import { notifyLeaveDecision, notifyLeaveCancelled } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conn = getServerSupabase();
    let approverEmail: string | null = null;

    if (conn) {
      const user = await getServerUser(request, conn.client);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      approverEmail = user.email ?? null;
    }

    const body = await request.json();
    const { action, approver_notes } = body;

    if (!['approved', 'rejected', 'cancelled'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const data = await withPgClient(async (client) => {
      // Fetch the leave request first so we can guard self-approval
      const existing = await client.query(
        'SELECT * FROM leave_requests WHERE id = $1',
        [id]
      );
      if (existing.rows.length === 0) throw new Error('Leave request not found');

      const leave = existing.rows[0];

      // ── Self-approval / self-cancel guard ──────────────────────────────────
      if (approverEmail && leave.employee_email) {
        const sameEmail =
          approverEmail.toLowerCase() === leave.employee_email.toLowerCase();

        if (sameEmail && (action === 'approved' || action === 'rejected')) {
          throw new Error(
            'You cannot approve or reject your own leave request.'
          );
        }
        if (sameEmail && action === 'cancelled') {
          throw new Error(
            'You cannot cancel your own leave request from this panel. Use "Cancel Request" on your dashboard instead.'
          );
        }
      }

      // ── Cancel guard: only valid on approved leaves ──────────────────────
      if (action === 'cancelled' && leave.status !== 'approved') {
        throw new Error(
          `Cannot cancel a leave that is currently "${leave.status}". Only approved leaves can be cancelled.`
        );
      }

      // ── Approve / Reject guard: only valid on pending leaves ─────────────
      if (
        (action === 'approved' || action === 'rejected') &&
        leave.status !== 'pending'
      ) {
        throw new Error(
          `Cannot ${action} a leave that is already "${leave.status}".`
        );
      }

      const res = await client.query(
        `UPDATE leave_requests
         SET status = $1, approver_notes = $2, approver_email = $3,
             approved_at = NOW(), updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [action, approver_notes || null, approverEmail, id]
      );

      const updated = res.rows[0];

      // ── Notifications (best-effort, never blocks) ─────────────────────────
      if (action === 'cancelled') {
        await notifyLeaveCancelled(client, updated, approverEmail);
      } else {
        await notifyLeaveDecision(client, updated);
      }

      return updated;
    });

    return NextResponse.json(data);
  } catch (error: any) {
    const status =
      error.message.includes('cannot approve or reject your own') ||
      error.message.includes('cannot cancel your own')
        ? 403
        : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
