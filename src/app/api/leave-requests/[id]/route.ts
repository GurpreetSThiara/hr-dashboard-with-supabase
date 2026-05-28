import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';

// PUT — admin can edit any leave request
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { employee_name, employee_email, leave_type, start_date, end_date, reason, days_count, status } = body;

    const data = await withPgClient(async (client) => {
      const res = await client.query(
        `UPDATE leave_requests
         SET employee_name  = COALESCE($1, employee_name),
             employee_email = COALESCE($2, employee_email),
             leave_type     = COALESCE($3, leave_type),
             start_date     = COALESCE($4, start_date),
             end_date       = COALESCE($5, end_date),
             reason         = COALESCE($6, reason),
             days_count     = COALESCE($7, days_count),
             status         = COALESCE($8, status),
             updated_at     = NOW()
         WHERE id = $9
         RETURNING *`,
        [employee_name || null, employee_email || null, leave_type || null,
         start_date || null, end_date || null, reason || null,
         days_count || null, status || null, params.id]
      );
      if (res.rows.length === 0) throw new Error('Leave request not found');
      return res.rows[0];
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — admin can remove a leave request
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await withPgClient(async (client) => {
      const res = await client.query(
        'DELETE FROM leave_requests WHERE id = $1 RETURNING id',
        [params.id]
      );
      if (res.rows.length === 0) throw new Error('Leave request not found');
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
