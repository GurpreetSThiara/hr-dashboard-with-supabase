import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rules = await withPgClient(async (client) => {
      // Return all leave types with their rules for this version (null columns = no rule yet)
      const res = await client.query(
        `SELECT
           lt.id AS leave_type_id,
           lt.name AS leave_type_name,
           lt.color,
           lt.requires_document AS type_requires_document,
           r.id,
           r.days_per_year,
           r.carry_forward_allowed,
           r.max_carry_forward,
           r.gender_specific,
           r.requires_document,
           r.pro_rata
         FROM leave_types lt
         LEFT JOIN leave_policy_rules r
           ON r.leave_type_id = lt.id AND r.version_id = $1
         ORDER BY lt.name ASC`,
        [id]
      );
      return res.rows;
    });
    return NextResponse.json({ rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — replace all rules for this version
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { rules } = body as {
      rules: {
        leave_type_id: string;
        leave_type_name: string;
        days_per_year: number;
        carry_forward_allowed: boolean;
        max_carry_forward: number;
        gender_specific: string | null;
        requires_document: boolean;
        pro_rata: boolean;
      }[];
    };

    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: 'rules must be an array' }, { status: 400 });
    }

    await withPgClient(async (client) => {
      // Check version exists and isn't superseded
      const check = await client.query(
        "SELECT status FROM leave_policy_versions WHERE id = $1",
        [id]
      );
      if (check.rows.length === 0) throw new Error('Version not found');
      if (check.rows[0].status === 'superseded') {
        throw new Error('Cannot edit rules of a superseded policy version.');
      }

      await client.query('BEGIN');
      try {
        // Delete existing rules for this version
        await client.query(
          'DELETE FROM leave_policy_rules WHERE version_id = $1',
          [id]
        );

        // Insert new rules
        for (const rule of rules) {
          await client.query(
            `INSERT INTO leave_policy_rules
               (version_id, leave_type_id, leave_type_name, days_per_year,
                carry_forward_allowed, max_carry_forward, gender_specific,
                requires_document, pro_rata, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
            [
              id,
              rule.leave_type_id,
              rule.leave_type_name,
              rule.days_per_year || 0,
              rule.carry_forward_allowed || false,
              rule.max_carry_forward || 0,
              rule.gender_specific || null,
              rule.requires_document || false,
              rule.pro_rata || false,
            ]
          );
        }

        // Update version's updated_at
        await client.query(
          'UPDATE leave_policy_versions SET updated_at = NOW() WHERE id = $1',
          [id]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
