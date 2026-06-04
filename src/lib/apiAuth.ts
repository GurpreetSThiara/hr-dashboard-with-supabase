/**
 * Centralized server-side API authorization.
 *
 * Every protected route handler should call one of these guards. They build on
 * `getActorFromRequest` (which verifies the Supabase session token server-side
 * and resolves the user's role from the DB) and add tier-based authorization.
 *
 * CRITICAL: authorization decisions must derive from the server-resolved actor,
 * never from values supplied in the request body or headers by the client.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest, isHROrAbove, type ActorContext } from '@/lib/leavePermissions';

/** Canonical role → tier map (single source of truth, lower = more privileged). */
export const ROLE_TIER_MAP: Record<string, number> = {
  'Super Admin': 1, 'Owner': 2, 'Admin': 3, 'HR Admin': 4, 'HR Manager': 5,
  'HR Executive': 6, 'Recruiter': 7, 'Payroll Manager': 8, 'Finance': 9,
  'Compliance': 10, 'IT Ops': 11, 'Director': 12, 'Manager': 13,
  'Team Lead': 14, 'Employee': 15, 'Contractor': 16, 'Intern': 17, 'Read-Only User': 18,
};

export interface AuthedActor extends ActorContext {
  /** Resolved from role via ROLE_TIER_MAP (defaults to 18 / least privilege). */
  tier: number;
}

/** Thrown by the guards; convert with `authError()` in the route's catch block. */
export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiAuthError';
    this.status = status;
  }
}

function withTier(actor: ActorContext): AuthedActor {
  return { ...actor, tier: ROLE_TIER_MAP[actor.role] ?? 18 };
}

/** Require a valid, authenticated session. Throws 401 otherwise. */
export async function requireAuth(request: NextRequest): Promise<AuthedActor> {
  const actor = await getActorFromRequest(request);
  if (!actor) throw new ApiAuthError('Unauthorized', 401);
  return withTier(actor);
}

/** Require the actor's tier to be ≤ maxTier (i.e. at least that privileged). */
export async function requireMaxTier(request: NextRequest, maxTier: number): Promise<AuthedActor> {
  const actor = await requireAuth(request);
  if (actor.tier > maxTier) {
    throw new ApiAuthError('Forbidden — insufficient privileges for this action', 403);
  }
  return actor;
}

/** Require HR-or-above (per the central allowlist). */
export async function requireHR(request: NextRequest): Promise<AuthedActor> {
  const actor = await requireAuth(request);
  if (!isHROrAbove(actor.role)) throw new ApiAuthError('Forbidden', 403);
  return actor;
}

/** admin_panel — Super Admin / Owner only (tier ≤ 2). */
export async function requireAdmin(request: NextRequest): Promise<AuthedActor> {
  return requireMaxTier(request, 2);
}

/**
 * Permission-based guard: passes if the actor has the given permission via
 * EITHER their tier (role_permissions matrix) OR an active permission-set grant
 * (direct or via role group). This is the enforcement counterpart to the
 * effective-permissions resolver, so additive grants actually unlock server
 * access — not just UI.
 */
export async function requirePermission(
  request: NextRequest,
  permission: string
): Promise<AuthedActor> {
  const actor = await requireAuth(request);
  // Lazy import avoids a circular dependency (accessControl → pgClient only).
  const { actorHasPermission } = await import('@/lib/accessControl');
  const ok = await actorHasPermission({ email: actor.email, tier: actor.tier }, permission as any);
  if (!ok) throw new ApiAuthError('Forbidden — missing permission: ' + permission, 403);
  return actor;
}

/** manage_employees — tier ≤ 7 (Super Admin … Recruiter). */
export async function requireManageEmployees(request: NextRequest): Promise<AuthedActor> {
  return requireMaxTier(request, 7);
}

/** manage_policies — tier ≤ 2. */
export async function requireManagePolicies(request: NextRequest): Promise<AuthedActor> {
  return requireMaxTier(request, 2);
}

/**
 * Guard for destructive seed/bootstrap endpoints.
 * Allows EITHER an operator presenting the `x-seed-secret` header matching the
 * `SEED_SECRET` env var (for bootstrapping an empty DB), OR an authenticated
 * Super Admin (tier 1). Anonymous access is always rejected. Static-string
 * "admin-key" style checks are NOT accepted.
 */
export async function requireSeedAccess(request: NextRequest): Promise<void> {
  const secret = process.env.SEED_SECRET;
  const provided = request.headers.get('x-seed-secret');
  if (secret && provided && provided === secret) return;
  const actor = await requireAuth(request);
  if (actor.tier > 1) {
    throw new ApiAuthError('Forbidden — seeding requires Super Admin or a valid seed secret', 403);
  }
}

/**
 * Whether demo features (quick-login password exposure, demo-user seeding) are
 * enabled. True in non-production, or when NEXT_PUBLIC_DEMO_MODE is explicitly
 * set. In production this is OFF unless deliberately enabled.
 */
export function isDemoMode(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  );
}

/**
 * Convert a thrown error into a JSON response if it is an ApiAuthError.
 * Returns null for any other error so the caller can handle it normally.
 *
 *   } catch (err) {
 *     const authResp = authError(err);
 *     if (authResp) return authResp;
 *     return NextResponse.json({ error: (err as Error).message }, { status: 500 });
 *   }
 */
export function authError(err: unknown): NextResponse | null {
  if (err instanceof ApiAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}
