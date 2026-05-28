import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Sign in with email/password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    // Get user metadata
    const userRole = data?.user?.user_metadata?.role || 'Employee';
    const userTier = data?.user?.user_metadata?.tier || 15;

    // Ensure user profile exists
    await supabase
      .from('users')
      .upsert({
        email,
        role: userRole,
        tier: userTier,
      })
      .eq('email', email);

    return NextResponse.json({
      data,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: userRole,
        tier: userTier,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
