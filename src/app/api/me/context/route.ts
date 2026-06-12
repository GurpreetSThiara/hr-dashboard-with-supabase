import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authError } from '@/lib/apiAuth';
import { computeOrgContext, touchOrgActivity } from '@/lib/orgContext';

/**
 * GET /api/me/context — the unified tenant context for the current user.
 * Powers HR-app gating, banners, seat warnings, expiry/maintenance notices and
 * branding. This is the sync point with the Super Owner app.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    const ctx = await computeOrgContext(actor.organizationId, actor.isSuperOwner);
    // F24: stamp org activity (non-blocking).
    void touchOrgActivity(actor.organizationId);
    return NextResponse.json(ctx);
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
