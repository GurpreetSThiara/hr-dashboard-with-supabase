import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, color, requires_document } = body;

    const type = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE leave_types
         SET name              = COALESCE($1, name),
             description       = COALESCE($2, description),
             color             = COALESCE($3, color),
             requires_document = COALESCE($4, requires_document),
             updated_at        = NOW()
         WHERE id = $5
         RETURNING *`,
        [name?.trim() || null, description ?? null, color || null,
         requires_document ?? null, params.id]
      );
      if (res.rows.length === 0) throw new Error('Leave type not found');
      return res.rows[0];
    });

    return NextResponse.json({ type });
  } catch (error: any) {
    if (error.message?.includes('unique') || error.code === '23505') {
      return NextResponse.json({ error: 'A leave type with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await withPgClient(async (client) => {
      // Check if any rules reference this type
      const refRes = await client.query(
        'SELECT COUNT(*) FROM leave_policy_rules WHERE leave_type_id = $1',
        [params.id]
      );
      if (parseInt(refRes.rows[0].count) > 0) {
        throw new Error('Cannot delete: this leave type is used in policy rules. Remove it from all policy versions first.');
      }

      const res = await client.query(
        'DELETE FROM leave_types WHERE id = $1 RETURNING id',
        [params.id]
      );
      if (res.rows.length === 0) throw new Error('Leave type not found');
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
