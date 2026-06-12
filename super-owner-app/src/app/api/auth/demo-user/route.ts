import { NextResponse } from 'next/server';
import { DEMO_SUPER_OWNER } from '@/lib/demoSuperOwner';
import { isDemoMode } from '@/lib/auth';

/**
 * GET /api/auth/demo-user — the demo Super Owner identity. The plaintext
 * password is ONLY returned in demo mode; in production it is omitted (which
 * disables the one-click demo login by design).
 */
export async function GET() {
  const demo = isDemoMode();
  return NextResponse.json({
    demoMode: demo,
    email: DEMO_SUPER_OWNER.email,
    full_name: DEMO_SUPER_OWNER.full_name,
    role: DEMO_SUPER_OWNER.role,
    ...(demo ? { password: DEMO_SUPER_OWNER.password } : {}),
  });
}
