import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireAuth, requireManageEmployees, authError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: directory requires authentication. Salary band is stripped for
    // non-HR viewers (tier > 6).
    const actor = await requireAuth(request);
    const isHrViewer = actor.tier <= 6;

    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json({ error: 'Supabase connection not configured' }, { status: 503 });
    }
    const supabase = conn.client;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('employees')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('emp_id', { ascending: true });

    if (error) throw error;

    // Strip sensitive compensation data from non-HR viewers
    const rows = isHrViewer
      ? data
      : (data || []).map(({ salary_band, ...rest }: any) => rest);

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: creating employees requires manage_employees (tier ≤ 7).
    const actor = await requireManageEmployees(request);

    const conn = getServerSupabase();
    if (!conn) {
      return NextResponse.json({ error: 'Supabase connection not configured' }, { status: 503 });
    }
    const supabase = conn.client;
    const user = { email: actor.email };

    const body = await request.json();
    
    // Generate emp_id
    const { data: lastEmp } = await supabase
      .from('employees')
      .select('emp_id')
      .order('emp_id', { ascending: false })
      .limit(1);
    
    const lastId = lastEmp?.[0]?.emp_id || 'EMP-0000';
    const nextNum = parseInt(lastId.split('-')[1]) + 1;
    const emp_id = `EMP-${String(nextNum).padStart(4, '0')}`;

    const { data, error } = await supabase
      .from('employees')
      .insert([{ ...body, emp_id }])
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from('activity_feed').insert([{
      user_email: user.email,
      action: 'created_employee',
      description: `Created employee: ${body.first_name} ${body.last_name}`,
      target_id: data.id,
      target_type: 'employee',
    }]);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
