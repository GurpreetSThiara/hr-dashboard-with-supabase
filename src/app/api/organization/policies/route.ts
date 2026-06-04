/**
 * GET  /api/organization/policies — list active policies + the caller's
 *      acknowledgement status for each (for the current version).
 * POST /api/organization/policies — create a policy (HR / manage_policies).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, requireManagePolicies, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `
        SELECT p.*,
               (a.id IS NOT NULL) AS acknowledged,
               a.acknowledged_at,
               (p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE) AS expired
        FROM org_policies p
        LEFT JOIN policy_acknowledgements a
          ON a.policy_id = p.id
         AND a.policy_version = p.version
         AND LOWER(a.employee_email) = LOWER($1)
        WHERE p.is_active = true ${includeArchived ? '' : 'AND p.is_archived = false'}
        ORDER BY p.category, p.title
        `,
        [actor.email]
      );
      return res.rows;
    });

    return NextResponse.json({ policies: rows });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireManagePolicies(request);
    const body = await request.json();
    const { title, category, content, effective_date, expiry_date, requires_acknowledgement } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const row = await withPgClient(async (client) => {
      const res = await client.query(
        `INSERT INTO org_policies
           (title, category, content, effective_date, expiry_date, requires_acknowledgement, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          title.trim(),
          category || 'General',
          content || null,
          effective_date || null,
          expiry_date || null,
          requires_acknowledgement !== false,
          actor.email,
        ]
      );
      return res.rows[0];
    });

    return NextResponse.json({ policy: row }, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
