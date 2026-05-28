import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role to bypass RLS and email verification
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { email, password, role, tier } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Create user with admin API (bypasses email verification)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role,
        tier,
      },
    });

    if (error) {
      // If user already exists, that's fine
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { message: 'User already exists', data: null },
          { status: 200 }
        );
      }
      throw error;
    }

    // Create user profile
    if (data?.user) {
      await supabase
        .from('users')
        .upsert({
          email,
          role: role || 'Employee',
          tier: tier || 15,
        })
        .eq('email', email);
    }

    return NextResponse.json({ data, message: 'User created successfully' });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
