import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await withPgClient(async (client) => {
      const res = await client.query(
        'SELECT * FROM employees WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) throw new Error('Employee not found');
      return res.rows[0];
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify session via server supabase (optional — don't block if no supabase)
    const conn = getServerSupabase();
    let userEmail: string | null = null;
    if (conn) {
      const { data: { session } } = await conn.client.auth.getSession();
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userEmail = session.user.email ?? null;
    }

    const body = await request.json();

    const data = await withPgClient(async (client) => {
      // Build dynamic SET clause from provided fields
      const allowed = [
        'first_name', 'last_name', 'email', 'phone', 'department',
        'position', 'start_date', 'salary', 'status', 'avatar_url',
        'address', 'city', 'country', 'bio', 'skills',
      ];
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in body) {
          updates.push(`${key} = $${idx++}`);
          values.push(body[key]);
        }
      }
      if (updates.length === 0) throw new Error('No valid fields to update');
      updates.push(`updated_at = NOW()`);
      values.push(id);

      const res = await client.query(
        `UPDATE employees SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (res.rows.length === 0) throw new Error('Employee not found');
      return res.rows[0];
    });

    // Log activity fire-and-forget
    if (conn) {
      void Promise.resolve(
        conn.client.from('activity_feed').insert([{
          user_email: userEmail,
          action: 'updated_employee',
          description: `Updated employee: ${data.first_name} ${data.last_name}`,
          target_id: data.id,
          target_type: 'employee',
        }])
      ).catch(() => {});
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify session via server supabase (optional)
    const conn = getServerSupabase();
    let userEmail: string | null = null;
    if (conn) {
      const { data: { session } } = await conn.client.auth.getSession();
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userEmail = session.user.email ?? null;
    }

    const employee = await withPgClient(async (client) => {
      const sel = await client.query(
        'SELECT first_name, last_name FROM employees WHERE id = $1',
        [id]
      );
      if (sel.rows.length === 0) throw new Error('Employee not found');

      await client.query('DELETE FROM employees WHERE id = $1', [id]);
      return sel.rows[0];
    });

    // Log activity fire-and-forget
    if (conn) {
      void Promise.resolve(
        conn.client.from('activity_feed').insert([{
          user_email: userEmail,
          action: 'deleted_employee',
          description: `Deleted employee: ${employee.first_name} ${employee.last_name}`,
          target_id: id,
          target_type: 'employee',
        }])
      ).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
