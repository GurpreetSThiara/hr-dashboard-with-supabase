import { NextRequest, NextResponse } from 'next/server';
import { getActor, authError } from '@/lib/auth';

/** GET /api/me — current session's identity + super-owner flag (or 401). */
export async function GET(request: NextRequest) {
  try {
    const actor = await getActor(request);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({
      email: actor.email,
      role: actor.role,
      isSuperOwner: actor.role === 'Super Owner',
    });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
