/**
 * Effective-permission resolution.
 *
 * A user's effective permissions = the union of:
 *   1. TIER-based grants — the role_permissions matrix (DB, or hardcoded
 *      defaults) for the user's tier.
 *   2. ADDITIVE grants — permission sets assigned to the user directly OR to a
 *      role group they belong to, that are active and not expired.
 *
 * This is the single source of truth used by both `requirePermission` (server
 * enforcement) and GET /api/me/effective-permissions (client UI gating), so the
 * two never disagree.
 */
import { withPgClient } from '@/lib/pgClient';

export const KNOWN_PERMISSIONS = [
  'view_dashboard', 'view_hr_dashboard', 'view_employees', 'manage_employees',
  'view_leaves', 'approve_leaves', 'manage_policies', 'view_attendance',
  'manage_attendance', 'view_hierarchy', 'manage_hierarchy', 'admin_panel',
  'view_time_tracking', 'manage_own_time', 'approve_time', 'view_time_reports',
  'manage_time_admin',
] as const;
export type PermissionKey = (typeof KNOWN_PERMISSIONS)[number];

// Hardcoded defaults — mirror src/lib/useRoleBasedAccess.ts. Used when the DB
// matrix has no row for a permission.
const DEFAULT_PERMISSIONS: Record<string, number[]> = {
  view_dashboard:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  view_hr_dashboard:[1,2,3,4,5,6,7,8,9,10,11],
  view_employees:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_employees: [1,2,3,4,5,6,7],
  view_leaves:      [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  approve_leaves:   [1,2,3,4,5,6,12,13],
  manage_policies:  [1,2],
  view_attendance:  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_attendance:[1,2,3,4,5],
  view_hierarchy:   [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
  manage_hierarchy: [1,2,3,4],
  admin_panel:      [1,2],
  // Time tracking
  view_time_tracking: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],
  manage_own_time:    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],
  approve_time:       [1,2,3,4,5,6,12,13,14],
  view_time_reports:  [1,2,3,4,5,8,9,12,13],
  manage_time_admin:  [1,2,3],
};

/** Load the active tier→permission matrix from DB, falling back to defaults. */
async function loadMatrix(client: any): Promise<Record<string, number[]>> {
  try {
    const res = await client.query(
      `SELECT permission, tier FROM role_permissions WHERE allowed = true`
    );
    if (!res.rows.length) return { ...DEFAULT_PERMISSIONS };
    const matrix: Record<string, number[]> = {};
    const seen = new Set<string>();
    for (const r of res.rows) {
      (matrix[r.permission] ||= []).push(r.tier);
      seen.add(r.permission);
    }
    // Fill any permission not present in DB from defaults
    for (const p of Object.keys(DEFAULT_PERMISSIONS)) {
      if (!seen.has(p)) matrix[p] = [...DEFAULT_PERMISSIONS[p]];
    }
    return matrix;
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

/** Additive permission keys granted to this user via permission sets. */
async function loadGrantedPermissions(client: any, email: string): Promise<string[]> {
  const res = await client.query(
    `
    SELECT DISTINCT perm
    FROM (
      SELECT unnest(ps.permissions) AS perm
      FROM permission_set_assignments a
      JOIN permission_sets ps ON ps.id = a.set_id
      WHERE a.is_active = true
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND (
          (a.principal_type = 'user' AND LOWER(a.principal_id) = LOWER($1))
          OR (a.principal_type = 'role_group' AND a.principal_id IN (
                SELECT group_id::text FROM role_group_members WHERE LOWER(user_email) = LOWER($1)
          ))
        )
    ) g
    `,
    [email]
  );
  return res.rows.map((r: any) => r.perm).filter((p: string) => KNOWN_PERMISSIONS.includes(p as PermissionKey));
}

/**
 * Compute the full effective permission set for a user. Accepts an existing pg
 * client (preferred inside a tx) or opens its own.
 */
export async function getEffectivePermissions(
  actor: { email: string; tier: number },
  client?: any
): Promise<string[]> {
  const run = async (cl: any): Promise<string[]> => {
    const [matrix, granted] = await Promise.all([
      loadMatrix(cl),
      loadGrantedPermissions(cl, actor.email),
    ]);
    const effective = new Set<string>(granted);
    for (const [perm, tiers] of Object.entries(matrix)) {
      if (tiers.includes(actor.tier)) effective.add(perm);
    }
    return [...effective].sort();
  };
  return client ? run(client) : withPgClient(run);
}

/** Whether the actor has a specific permission (tier grant OR set grant). */
export async function actorHasPermission(
  actor: { email: string; tier: number },
  permission: PermissionKey,
  client?: any
): Promise<boolean> {
  const eff = await getEffectivePermissions(actor, client);
  return eff.includes(permission);
}
