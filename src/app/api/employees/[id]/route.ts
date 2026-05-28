import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data, error } = await supabase
      .from('employees')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from('activity_feed').insert([{
      user_email: session.user.email,
      action: 'updated_employee',
      description: `Updated employee: ${data.first_name} ${data.last_name}`,
      target_id: data.id,
      target_type: 'employee',
    }]);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get employee info before deleting
    const { data: employee } = await supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('id', params.id)
      .single();

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    // Log activity
    await supabase.from('activity_feed').insert([{
      user_email: session.user.email,
      action: 'deleted_employee',
      description: `Deleted employee: ${employee?.first_name} ${employee?.last_name}`,
      target_id: params.id,
      target_type: 'employee',
    }]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
