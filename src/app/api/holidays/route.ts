/**
 * Public holiday endpoint — returns holidays visible to the authenticated user.
 * Resolves the employee's assigned holiday policy and returns the applicable
 * holidays.  Falls back to the default (company-wide) policy.
 *
 * GET /api/holidays?year=YYYY&type=mandatory|optional
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getActorFromRequest } from '@/lib/leavePermissions';

export async function GET(request: NextRequest) {
  try {
    const actor = await getActorFromRequest(request);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const type = searchParams.get('type'); // optional filter

    const data = await withPgClient(async (client) => {
      // Resolve employee's policy: individual → department → location → company-wide → default
      const policyRes = await client.query(`
        SELECT hp.id, hp.name
        FROM   holiday_policy_assignments hpa
        JOIN   holiday_policies hp ON hp.id = hpa.policy_id AND hp.is_active = true
        LEFT JOIN employees e ON LOWER(e.email) = $1
        WHERE  hpa.assignment_type = 'employee' AND hpa.assignment_value = COALESCE(e.id::text, '')
        UNION ALL
        SELECT hp.id, hp.name
        FROM   holiday_policy_assignments hpa
        JOIN   holiday_policies hp ON hp.id = hpa.policy_id AND hp.is_active = true
        LEFT JOIN employees e ON LOWER(e.email) = $1
        WHERE  hpa.assignment_type = 'department' AND hpa.assignment_value = COALESCE(e.department, '')
        UNION ALL
        SELECT hp.id, hp.name
        FROM   holiday_policy_assignments hpa
        JOIN   holiday_policies hp ON hp.id = hpa.policy_id AND hp.is_active = true
        WHERE  hpa.assignment_type = 'company'
        ORDER BY 1
        LIMIT 1
      `, [actor.email]);

      let policyId: string | null = policyRes.rows[0]?.id ?? null;

      // Fall back to the default policy
      if (!policyId) {
        const defRes = await client.query(
          `SELECT id FROM holiday_policies WHERE is_default = true AND is_active = true LIMIT 1`
        );
        policyId = defRes.rows[0]?.id ?? null;
      }

      if (!policyId) {
        // No policy configured — return empty
        return { holidays: [], policy: null };
      }

      // Fetch holidays for that policy in the requested year
      const conditions: string[] = [
        `ch.is_archived = false`,
        `ch.year = $1`,
      ];
      const values: any[] = [parseInt(year)];

      if (type) {
        values.push(type);
        conditions.push(`ch.holiday_type = $${values.length}`);
      }

      const hRes = await client.query(`
        SELECT ch.id, ch.name, ch.date, ch.holiday_type, ch.description,
               ch.is_recurring, ch.country_code, ch.region
        FROM   company_holidays ch
        JOIN   holiday_policy_holidays hph ON hph.holiday_id = ch.id
        WHERE  hph.policy_id = $2
          AND  ${conditions.join(' AND ')}
        ORDER BY ch.date
      `, [parseInt(year), policyId]);

      const policyName = policyRes.rows[0]?.name ?? (await client.query(
        `SELECT name FROM holiday_policies WHERE id = $1`, [policyId]
      )).rows[0]?.name;

      // ── Long-weekend detection ────────────────────────────────────────────
      // A holiday creates a long weekend when consecutive non-working days
      // (weekend + holiday) form a block of 3+ days.
      const allDates = new Set(hRes.rows.map((h: any) => h.date.toISOString().slice(0, 10)));

      function isNonWorking(d: Date): boolean {
        const day = d.getDay();
        if (day === 0 || day === 6) return true; // weekend
        return allDates.has(d.toISOString().slice(0, 10));
      }

      const holidaysWithLW = hRes.rows.map((h: any) => {
        const dateStr: string = h.date.toISOString().slice(0, 10);
        const d = new Date(dateStr);

        // Walk back to find block start
        let blockStart = new Date(d);
        while (true) {
          const prev = new Date(blockStart);
          prev.setDate(prev.getDate() - 1);
          if (!isNonWorking(prev)) break;
          blockStart = prev;
        }
        // Walk forward to find block end
        let blockEnd = new Date(d);
        while (true) {
          const next = new Date(blockEnd);
          next.setDate(next.getDate() + 1);
          if (!isNonWorking(next)) break;
          blockEnd = next;
        }

        const totalDays = Math.round(
          (blockEnd.getTime() - blockStart.getTime()) / 86400000
        ) + 1;

        return {
          ...h,
          date:              dateStr,
          is_long_weekend:   totalDays >= 3,
          long_weekend_start: totalDays >= 3 ? blockStart.toISOString().slice(0, 10) : null,
          long_weekend_end:   totalDays >= 3 ? blockEnd.toISOString().slice(0, 10) : null,
          long_weekend_days:  totalDays >= 3 ? totalDays : null,
        };
      });

      return { holidays: holidaysWithLW, policy: { id: policyId, name: policyName } };
    });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
