/**
 * Server-side helpers for writing persistent notifications.
 *
 * These run inside route handlers via `withPgClient`, so the inserts use the
 * direct Postgres connection (bypasses RLS) — necessary because the actor
 * writing the notification is usually NOT the recipient.
 */

// Roles that should be notified of every new leave request (in addition to the
// applicant's own reporting manager).
export const HR_APPROVER_ROLES = [
  'Super Admin',
  'Owner',
  'Admin',
  'HR Admin',
  'HR Manager',
  'HR Executive',
];

interface LeaveRow {
  id: string;
  employee_id?: string | null;
  employee_email?: string | null;
  employee_name?: string | null;
  leave_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  days_count?: number | null;
}

function fmtDate(d?: string | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB');
  } catch {
    return String(d);
  }
}

async function insertNotifications(
  client: any,
  rows: Array<{
    recipient_email: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    entity_id?: string | null;
  }>
): Promise<void> {
  if (rows.length === 0) return;
  const values: any[] = [];
  const tuples = rows.map((r, i) => {
    const base = i * 6;
    values.push(
      r.recipient_email,
      r.type,
      r.title,
      r.message,
      r.link ?? null,
      r.entity_id ?? null
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });
  await client.query(
    `INSERT INTO notifications (recipient_email, type, title, message, link, entity_id)
     VALUES ${tuples.join(', ')}`,
    values
  );
}

/**
 * Notify the applicant's reporting manager + HR approvers that a new leave
 * request was submitted. Never notifies the applicant themselves.
 */
export async function notifyLeaveSubmitted(
  client: any,
  leave: LeaveRow,
  actorEmail?: string | null
): Promise<void> {
  try {
    const recipients = new Set<string>();

    // 1. Reporting manager (employees.manager holds the manager's email)
    if (leave.employee_id || leave.employee_email) {
      const empRes = await client.query(
        'SELECT manager FROM employees WHERE id = $1 OR email = $2 LIMIT 1',
        [leave.employee_id ?? null, leave.employee_email ?? null]
      );
      const mgr: string | undefined = empRes.rows[0]?.manager;
      if (mgr && mgr.includes('@')) recipients.add(mgr.toLowerCase());
    }

    // 2. HR approver roles
    const hrRes = await client.query(
      `SELECT email FROM users WHERE role = ANY($1) AND email IS NOT NULL`,
      [HR_APPROVER_ROLES]
    );
    hrRes.rows.forEach((r: any) => r.email && recipients.add(String(r.email).toLowerCase()));

    // Never notify the employee who the leave belongs to, nor whoever filed it.
    if (leave.employee_email) recipients.delete(leave.employee_email.toLowerCase());
    if (actorEmail) recipients.delete(actorEmail.toLowerCase());

    const who = leave.employee_name || leave.employee_email || 'An employee';
    const range = `${fmtDate(leave.start_date)} → ${fmtDate(leave.end_date)}`;
    const days = leave.days_count ? ` (${leave.days_count}d)` : '';

    await insertNotifications(
      client,
      [...recipients].map((email) => ({
        recipient_email: email,
        type: 'leave_submitted',
        title: 'New Leave Request',
        message: `${who} requested ${leave.leave_type || 'leave'} ${range}${days}.`,
        link: '/leave-attendance',
        entity_id: leave.id,
      }))
    );
  } catch (err) {
    // Notifications must never break the primary action.
    console.error('notifyLeaveSubmitted failed:', err);
  }
}

/**
 * Notify the employee that their approved leave was cancelled by HR/management.
 * Also notifies the original approver if known.
 */
export async function notifyLeaveCancelled(
  client: any,
  leave: LeaveRow & { status?: string; approver_notes?: string | null },
  cancelledByEmail?: string | null
): Promise<void> {
  try {
    if (!leave.employee_email) return;
    const range = `${fmtDate(leave.start_date)} → ${fmtDate(leave.end_date)}`;
    const note = leave.approver_notes ? ` Note: ${leave.approver_notes}` : '';

    await insertNotifications(client, [
      {
        recipient_email: leave.employee_email.toLowerCase(),
        type: 'leave_rejected',
        title: 'Leave Cancelled by HR',
        message: `Your approved ${
          leave.leave_type || 'leave'
        } request ${range} has been cancelled by HR/management.${note}`,
        link: '/my-dashboard',
        entity_id: leave.id,
      },
    ]);
  } catch (err) {
    console.error('notifyLeaveCancelled failed:', err);
  }
}

/**
 * Notify the employee that their leave request was approved or rejected.
 */
export async function notifyLeaveDecision(
  client: any,
  leave: LeaveRow & { status?: string; approver_notes?: string | null }
): Promise<void> {
  try {
    if (!leave.employee_email) return;
    const approved = leave.status === 'approved';
    const range = `${fmtDate(leave.start_date)} → ${fmtDate(leave.end_date)}`;
    const note = leave.approver_notes ? ` Note: ${leave.approver_notes}` : '';

    await insertNotifications(client, [
      {
        recipient_email: leave.employee_email.toLowerCase(),
        type: approved ? 'leave_approved' : 'leave_rejected',
        title: approved ? 'Leave Approved ✅' : 'Leave Rejected',
        message: `Your ${leave.leave_type || 'leave'} request ${range} was ${
          approved ? 'approved' : 'rejected'
        }.${note}`,
        link: '/my-dashboard',
        entity_id: leave.id,
      },
    ]);
  } catch (err) {
    console.error('notifyLeaveDecision failed:', err);
  }
}

// ── Attendance Regularizations ─────────────────────────────────────────────

interface RegularizationRow {
  id: string;
  employee_id?: string | null;
  employee_name?: string | null;
  date?: string | null;
  status?: string | null;
  approver_notes?: string | null;
}

/**
 * Notify the applicant's reporting manager + HR approvers that a new
 * attendance-regularization request was submitted. This is the fix for the
 * "RM did not receive the request" bug — previously NO notification was sent.
 *
 * @param employee  { email, manager } of the applicant (manager holds RM email)
 */
export async function notifyRegularizationSubmitted(
  client: any,
  reg: RegularizationRow,
  employee: { email?: string | null; manager?: string | null },
  actorEmail?: string | null
): Promise<void> {
  try {
    const recipients = new Set<string>();

    // 1. Reporting manager (employees.manager holds the manager's email)
    if (employee.manager && employee.manager.includes('@')) {
      recipients.add(employee.manager.toLowerCase());
    }

    // 2. HR approver roles (org-wide safety net so requests are never orphaned)
    const hrRes = await client.query(
      `SELECT email FROM users WHERE role = ANY($1) AND email IS NOT NULL`,
      [HR_APPROVER_ROLES]
    );
    hrRes.rows.forEach((r: any) => r.email && recipients.add(String(r.email).toLowerCase()));

    // Never notify the applicant or whoever filed it.
    if (employee.email) recipients.delete(employee.email.toLowerCase());
    if (actorEmail) recipients.delete(actorEmail.toLowerCase());

    if (recipients.size === 0) return;

    const who = reg.employee_name || employee.email || 'An employee';
    await insertNotifications(
      client,
      [...recipients].map((email) => ({
        recipient_email: email,
        type: 'regularization_submitted',
        title: 'Attendance Regularization Request',
        message: `${who} requested an attendance correction for ${fmtDate(reg.date)}. Pending your approval.`,
        link: '/leave-attendance',
        entity_id: reg.id,
      }))
    );
  } catch (err) {
    console.error('notifyRegularizationSubmitted failed:', err);
  }
}

/**
 * Notify the employee that their regularization was approved/rejected.
 */
export async function notifyRegularizationDecision(
  client: any,
  reg: RegularizationRow,
  employeeEmail?: string | null
): Promise<void> {
  try {
    if (!employeeEmail) return;
    const approved = reg.status === 'approved';
    const note = reg.approver_notes ? ` Note: ${reg.approver_notes}` : '';
    await insertNotifications(client, [
      {
        recipient_email: employeeEmail.toLowerCase(),
        type: 'regularization_updated',
        title: approved ? 'Regularization Approved ✅' : 'Regularization Rejected',
        message: `Your attendance correction for ${fmtDate(reg.date)} was ${
          approved ? 'approved' : 'rejected'
        }.${note}`,
        link: '/leave-attendance',
        entity_id: reg.id,
      },
    ]);
  } catch (err) {
    console.error('notifyRegularizationDecision failed:', err);
  }
}
