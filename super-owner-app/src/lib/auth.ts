/**
 * Server-side authorization for the Super Owner app.
 *
 * The Super Owner is the platform-level account (role 'Super Owner', tier 0)
 * that belongs to no organization. This app is for the Super Owner ONLY — every
 * route guards with requireSuperOwner.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { getServerSupabase, getServerUser } from '@/lib/supabase/server';

export interface SuperOwnerActor {
  userId: string;
  email: string;
  role: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/** Resolve the verified actor (session + role from DB). Null if no session. */
export async function getActor(request: NextRequest): Promise<SuperOwnerActor | null> {
  const conn = getServerSupabase();
  if (!conn) return null;
  const user = await getServerUser(request, conn.client);
  if (!user) return null;

  return withPgClient(async (client) => {
    const res = await client.query(`SELECT role FROM users WHERE id = $1`, [user.id]);
    return {
      userId: user.id,
      email: (user.email ?? '').toLowerCase(),
      role: res.rows[0]?.role ?? 'Employee',
    };
  });
}

/** Require the actor to be the platform Super Owner. Throws AuthError otherwise. */
export async function requireSuperOwner(request: NextRequest): Promise<SuperOwnerActor> {
  const actor = await getActor(request);
  if (!actor) throw new AuthError('Unauthorized', 401);
  if (actor.role !== 'Super Owner') throw new AuthError('Forbidden — Super Owner only', 403);
  return actor;
}

/** Convert an AuthError into a JSON response; returns null for other errors. */
export function authError(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/**
 * Whether demo features (one-click demo login, demo-user seeding) are enabled.
 * True in non-production, or when NEXT_PUBLIC_DEMO_MODE is explicitly set.
 */
export function isDemoMode(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}
