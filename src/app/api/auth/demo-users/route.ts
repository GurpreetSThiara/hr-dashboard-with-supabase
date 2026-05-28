import { NextResponse } from 'next/server';
import { DEMO_USERS, PASSWORD_BY_TIER } from '@/lib/demoUsers';
import { getServerSupabase } from '@/lib/supabase/server';

// GET — returns the actual seeded users from public.users so the login page
// reflects DB state. Falls back to the static demoUsers config if the table
// is empty or unreachable.
export async function GET() {
  const conn = getServerSupabase();

  // No Supabase configured at all → static fallback so login page still works
  if (!conn) {
    const users = DEMO_USERS.map(u => ({
      id: null, email: u.email, full_name: u.full_name, role: u.role,
      tier: u.tier, department: u.department, password: u.password,
    }));
    return NextResponse.json({ users, seeded: false, isFallback: true });
  }

  try {
    const { data, error } = await conn.client
      .from('users')
      .select('id, email, full_name, role, tier, department')
      .like('email', '%@hrcore.io')
      .order('tier', { ascending: true });

    if (error) throw error;

    const seeded = (data || []).length >= 18;

    if (!data || data.length === 0) {
      // Fall back to the static config (so the UI still works pre-seed)
      const users = DEMO_USERS.map(u => ({
        id: null,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        tier: u.tier,
        department: u.department,
        password: u.password,
      }));
      return NextResponse.json({ users, seeded: false, isFallback: true });
    }

    const users = data.map(u => ({
      ...u,
      password: PASSWORD_BY_TIER[u.tier] || 'HRCore@demo',
    }));

    return NextResponse.json({ users, seeded, isFallback: false });
  } catch (err: any) {
    // Static fallback so the login page is never broken
    const users = DEMO_USERS.map(u => ({
      id: null,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      tier: u.tier,
      department: u.department,
      password: u.password,
    }));
    return NextResponse.json({ users, seeded: false, isFallback: true, error: err.message });
  }
}
