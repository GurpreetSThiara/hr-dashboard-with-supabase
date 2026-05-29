import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase, getServerUser } from '@/lib/supabase/server';

// GET — Retrieve all pending or recent regularization requests (Admin/HR access)
export async function GET(request: NextRequest) {
  try {
    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json({ error: 'Supabase connection not configured' }, { status: 503 });
    }

    const user = await getServerUser(request, conn.client);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify permission: Must be HR/Manager
    const profileRes = await conn.client
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profileRes?.data?.role || 'Employee';
    const allowedRoles = ['Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager'];
    
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden: Manager access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const result = await withPgClient(async (client) => {
      let query = "SELECT * FROM attendance_regularizations";
      const values: any[] = [];
      
      if (status !== 'all') {
        query += " WHERE status = $1";
        values.push(status);
      }
      
      query += " ORDER BY created_at DESC";
      
      const res = await client.query(query, values);
      return res.rows;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
