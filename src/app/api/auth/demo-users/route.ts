import { NextResponse } from 'next/server';
import { DEMO_USERS, PASSWORD_BY_TIER } from '@/lib/demoUsers';
import { withPgClient } from '@/lib/pgClient';
import { isDemoMode } from '@/lib/apiAuth';

// SECURITY: plaintext demo passwords are ONLY exposed when demo mode is enabled
// (non-production, or NEXT_PUBLIC_DEMO_MODE=true). In production they are omitted,
// disabling quick-login by design.
function staticFallback() {
  const demo = isDemoMode();
  return DEMO_USERS.map(u => ({
    id: null, email: u.email, full_name: u.full_name,
    role: u.role, tier: u.tier, department: u.department,
    ...(demo ? { password: u.password } : {}),
  }));
}

export async function GET() {
  const demo = isDemoMode();
  try {
    const rows = await withPgClient(async (client) => {
      const res = await client.query(
        `SELECT id, email, full_name, role, tier, department
         FROM public.users
         WHERE email LIKE '%@hrcore.io'
         ORDER BY tier ASC`
      );
      return res.rows;
    });

    const seeded = rows.length >= 18;

    if (rows.length === 0) {
      return NextResponse.json({ users: staticFallback(), seeded: false, isFallback: true, demoMode: demo });
    }

    const users = rows.map((u: any) => ({
      ...u,
      ...(demo ? { password: PASSWORD_BY_TIER[u.tier] || 'HRCore@demo' } : {}),
    }));

    return NextResponse.json({ users, seeded, isFallback: false, demoMode: demo });
  } catch {
    // Static fallback so login page is never broken even if DB unreachable
    return NextResponse.json({ users: staticFallback(), seeded: false, isFallback: true, demoMode: demo });
  }
}
