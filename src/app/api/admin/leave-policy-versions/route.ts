import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireAuth, requireManagePolicies, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const versions = await withPgClient(async (client) => {
      const res = await client.query(`
        SELECT v.*,
               COUNT(r.id)::int AS rule_count
        FROM leave_policy_versions v
        LEFT JOIN leave_policy_rules r ON r.version_id = v.id
        GROUP BY v.id
        ORDER BY v.effective_date DESC, v.created_at DESC
      `);
      return res.rows;
    });
    return NextResponse.json({ versions });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireManagePolicies(request);
    const body = await request.json();
    const { name, description, effective_date, copy_from_version_id, created_by_email } = body;

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!effective_date)  return NextResponse.json({ error: 'Effective date is required' }, { status: 400 });

    const version = await withPgClient(async (client) => {
      // Create the version
      const vRes = await client.query(
        `INSERT INTO leave_policy_versions
           (name, description, effective_date, status, is_active, created_by_email, created_at, updated_at)
         VALUES ($1, $2, $3, 'draft', false, $4, NOW(), NOW())
         RETURNING *`,
        [name.trim(), description || null, effective_date, created_by_email || null]
      );
      const newVersion = vRes.rows[0];

      // If copying rules from another version, duplicate them
      if (copy_from_version_id) {
        await client.query(
          `INSERT INTO leave_policy_rules
             (version_id, leave_type_id, leave_type_name, days_per_year,
              carry_forward_allowed, max_carry_forward, gender_specific,
              requires_document, pro_rata, created_at, updated_at)
           SELECT $1, leave_type_id, leave_type_name, days_per_year,
                  carry_forward_allowed, max_carry_forward, gender_specific,
                  requires_document, pro_rata, NOW(), NOW()
           FROM leave_policy_rules
           WHERE version_id = $2`,
          [newVersion.id, copy_from_version_id]
        );
      }

      return newVersion;
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
