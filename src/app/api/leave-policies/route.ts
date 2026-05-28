import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

// GET leave policies and types
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeTypes = searchParams.get('includeTypes') === 'true';

    let query = supabase
      .from('leave_policies')
      .select('*')
      .order('leave_type_name', { ascending: true });

    const { data: policies, error } = await query;

    if (error) throw error;

    if (includeTypes) {
      const { data: types } = await supabase
        .from('leave_types')
        .select('*')
        .order('name', { ascending: true });
      
      return NextResponse.json({ policies, types });
    }

    return NextResponse.json({ policies });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// CREATE or UPDATE leave policy
export async function POST(request: NextRequest) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leave_type_id, leave_type_name, days_per_year, carry_forward_allowed, max_carry_forward } = body;

    if (!leave_type_id || !leave_type_name || !days_per_year) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('leave_policies')
      .upsert({
        leave_type_id,
        leave_type_name,
        days_per_year,
        carry_forward_allowed: carry_forward_allowed ?? true,
        max_carry_forward: max_carry_forward ?? 0,
      })
      .eq('leave_type_id', leave_type_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE leave policy
export async function DELETE(request: NextRequest) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const policyId = searchParams.get('id');

    if (!policyId) {
      return NextResponse.json({ error: 'Missing policy ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('leave_policies')
      .delete()
      .eq('id', policyId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
