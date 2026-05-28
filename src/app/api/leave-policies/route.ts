import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeTypes = searchParams.get('includeTypes') === 'true';

    const result = await withPgClient(async (client) => {
      // Prefer active policy version's rules; fall back to legacy leave_policies
      const versionRes = await client.query(
        "SELECT id FROM leave_policy_versions WHERE is_active = true LIMIT 1"
      );

      let policies: any[] = [];
      if (versionRes.rows.length > 0) {
        const versionId = versionRes.rows[0].id;
        const rulesRes = await client.query(
          `SELECT r.id, r.leave_type_id, r.leave_type_name, r.days_per_year,
                  r.carry_forward_allowed, r.max_carry_forward,
                  r.gender_specific, r.requires_document, r.pro_rata,
                  lt.color
           FROM leave_policy_rules r
           LEFT JOIN leave_types lt ON lt.id = r.leave_type_id
           WHERE r.version_id = $1
           ORDER BY r.leave_type_name ASC`,
          [versionId]
        );
        policies = rulesRes.rows;
      } else {
        const legacyRes = await client.query(
          'SELECT * FROM leave_policies ORDER BY leave_type_name ASC'
        );
        policies = legacyRes.rows;
      }

      let types: any[] = [];
      if (includeTypes) {
        const typesRes = await client.query(
          'SELECT * FROM leave_types ORDER BY name ASC'
        );
        types = typesRes.rows;
      }

      return { policies, types };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
