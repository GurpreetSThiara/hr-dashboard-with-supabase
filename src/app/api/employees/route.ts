import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      user_email: session.user.email,
      action: 'created_employee',
      description: `Created employee: ${body.first_name} ${body.last_name}`,
      target_id: data.id,
      target_type: 'employee',
    }]);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
