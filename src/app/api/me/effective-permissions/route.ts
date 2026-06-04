/**
 * GET /api/me/effective-permissions
 * Returns the authenticated user's full effective permission list (tier grants
 * merged with active permission-set grants). The client uses this so UI gating
 * matches server enforcement exactly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/apiAuth';
import { getEffectivePermissions } from '@/lib/accessControl';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    const permissions = await getEffectivePermissions({ email: actor.email, tier: actor.tier });
    return NextResponse.json({ permissions, tier: actor.tier, role: actor.role });
  } catch (err: any) {
    const authResp = authError(err);
    if (authResp) return authResp;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
