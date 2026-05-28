import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await withPgClient(async (client) => {
      const [vRes, rRes] = await Promise.all([
        client.query('SELECT * FROM leave_policy_versions WHERE id = $1', [params.id]),
        client.query(
          `SELECT r.*, lt.color, lt.description AS type_description
           FROM leave_policy_rules r
           LEFT JOIN leave_types lt ON lt.id = r.leave_type_id
           WHERE r.version_id = $1
           ORDER BY r.leave_type_name ASC`,
          [params.id]
        ),
      ]);
      if (vRes.rows.length === 0) throw new Error('Version not found');
      return { version: vRes.rows[0], rules: rRes.rows };
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, effective_date } = body;

    const version = await withPgClient(async (client) => {
      // Can't edit an active or superseded version's core fields
      const check = await client.query(
        "SELECT status FROM leave_policy_versions WHERE id = $1",
        [params.id]
      );
      if (check.rows.length === 0) throw new Error('Version not found');
      if (check.rows[0].status === 'superseded') {
        throw new Error('Cannot edit a superseded policy version.');
      }

      const res = await client.query(
        `UPDATE leave_policy_versions
         SET name           = COALESCE($1, name),
             description    = COALESCE($2, description),
             effective_date = COALESCE($3, effective_date),
             updated_at     = NOW()
         WHERE id = $4
         RETURNING *`,
        [name?.trim() || null, description ?? null, effective_date || null, params.id]
      );
      return res.rows[0];
    });

    return NextResponse.json({ version });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await withPgClient(async (client) => {
      const check = await client.query(
        "SELECT status, is_active FROM leave_policy_versions WHERE id = $1",
        [params.id]
      );
      if (check.rows.length === 0) throw new Error('Version not found');
      if (check.rows[0].is_active) {
        throw new Error('Cannot delete the currently active policy. Activate another version first.');
      }

      await client.query('DELETE FROM leave_policy_versions WHERE id = $1', [params.id]);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
