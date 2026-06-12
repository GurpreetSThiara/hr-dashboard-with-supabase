import { NextRequest, NextResponse } from 'next/server';
import { withTenantPgClient } from '@/lib/pgClient';
import { requireAuth, authError } from '@/lib/apiAuth';

/**
 * GET /api/me/insights — derived dashboard widgets (org-scoped):
 * upcoming birthdays + work anniversaries, who's on leave today,
 * my open to-dos, and upcoming company events.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    if (!actor.organizationId) {
      return NextResponse.json({ birthdays: [], anniversaries: [], onLeaveToday: [], myOpenTodos: 0, upcomingEvents: [] });
    }
    const data = await withTenantPgClient(actor.organizationId, async (client) => {
      const org = actor.organizationId;
      const [bdays, annivs, leave, todos, events] = await Promise.all([
        client.query(
          `SELECT first_name, last_name, date_of_birth FROM employees
            WHERE organization_id = $1 AND date_of_birth IS NOT NULL
              AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
            ORDER BY EXTRACT(DAY FROM date_of_birth) LIMIT 10`, [org]).catch(() => ({ rows: [] })),
        client.query(
          `SELECT first_name, last_name, join_date,
                  EXTRACT(YEAR FROM AGE(join_date))::int AS years
             FROM employees
            WHERE organization_id = $1 AND join_date IS NOT NULL
              AND EXTRACT(MONTH FROM join_date) = EXTRACT(MONTH FROM CURRENT_DATE)
              AND EXTRACT(YEAR FROM join_date) < EXTRACT(YEAR FROM CURRENT_DATE)
            ORDER BY EXTRACT(DAY FROM join_date) LIMIT 10`, [org]).catch(() => ({ rows: [] })),
        client.query(
          `SELECT employee_name, leave_type, start_date, end_date FROM leave_requests
            WHERE organization_id = $1 AND status = 'approved'
              AND CURRENT_DATE BETWEEN start_date AND end_date
            ORDER BY end_date LIMIT 20`, [org]).catch(() => ({ rows: [] })),
        client.query(
          `SELECT count(*)::int n FROM personal_tasks
            WHERE organization_id = $1 AND user_email = $2 AND is_done = false`, [org, actor.email]).catch(() => ({ rows: [{ n: 0 }] })),
        client.query(
          `SELECT title, event_date, location FROM company_events
            WHERE organization_id = $1 AND event_date >= CURRENT_DATE
            ORDER BY event_date LIMIT 5`, [org]).catch(() => ({ rows: [] })),
      ]);
      return {
        birthdays: bdays.rows,
        anniversaries: annivs.rows,
        onLeaveToday: leave.rows,
        myOpenTodos: todos.rows[0]?.n ?? 0,
        upcomingEvents: events.rows,
      };
    });
    return NextResponse.json(data);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
