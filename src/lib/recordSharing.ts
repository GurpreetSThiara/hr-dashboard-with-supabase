/**
 * Record-level sharing engine.
 *
 * A user's effective access level on a record is the MAXIMUM of:
 *   - ownership            → full
 *   - admin (tier ≤ 2)     → full
 *   - explicit record_shares matching any of the actor's principals:
 *       user (email), role (role name), role_group (group ids), department
 *
 * Access levels are ordered; helpers compare by rank.
 */
import type { AuthedActor } from '@/lib/apiAuth';

export const ACCESS_LEVELS = ['none', 'view', 'comment', 'edit', 'approve', 'delete', 'full'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];
const RANK: Record<AccessLevel, number> = {
  none: 0, view: 1, comment: 2, edit: 3, approve: 4, delete: 5, full: 6,
};

export function rankOf(level: AccessLevel): number { return RANK[level] ?? 0; }
export function meets(level: AccessLevel, required: AccessLevel): boolean {
  return rankOf(level) >= rankOf(required);
}

export interface ActorPrincipals {
  email: string;
  role: string;
  groupIds: string[];
  department: string | null;
  isAdmin: boolean;
}

/** Resolve the actor's principals (role-group memberships + department). */
export async function getActorPrincipals(client: any, actor: AuthedActor): Promise<ActorPrincipals> {
  const email = actor.email.toLowerCase();
  const [grp, emp] = await Promise.all([
    client.query(`SELECT group_id::text AS gid FROM role_group_members WHERE LOWER(user_email) = $1`, [email]),
    client.query(`SELECT department FROM employees WHERE LOWER(email) = $1 LIMIT 1`, [email]),
  ]);
  return {
    email,
    role: actor.role,
    groupIds: grp.rows.map((r: any) => r.gid),
    department: emp.rows[0]?.department ?? null,
    isAdmin: actor.tier <= 2,
  };
}

/** Highest access level the actor has on a specific record. */
export async function resolveRecordAccess(
  client: any,
  principals: ActorPrincipals,
  record: { id: string; owner_email?: string | null }
): Promise<AccessLevel> {
  if (principals.isAdmin) return 'full';
  if ((record.owner_email || '').toLowerCase() === principals.email) return 'full';

  const res = await client.query(
    `SELECT access_level FROM record_shares
     WHERE record_id = $1 AND access_level <> 'none'
       AND (
         (principal_type = 'user'       AND LOWER(principal_id) = $2)
         OR (principal_type = 'role'        AND principal_id = $3)
         OR (principal_type = 'role_group'  AND principal_id = ANY($4))
         OR (principal_type = 'department'  AND principal_id = $5)
       )`,
    [record.id, principals.email, principals.role, principals.groupIds, principals.department]
  );

  let best: AccessLevel = 'none';
  for (const row of res.rows) {
    if (rankOf(row.access_level) > rankOf(best)) best = row.access_level;
  }
  return best;
}

/**
 * Returns a SQL WHERE-fragment (+ params) restricting custom_records to those
 * the actor can at least VIEW. Append after a known param count.
 */
export function buildVisibleRecordsClause(
  principals: ActorPrincipals,
  startParam: number
): { clause: string; params: any[] } {
  if (principals.isAdmin) return { clause: '', params: [] };
  const p = startParam;
  // $p=email, $p+1=role, $p+2=groupIds[], $p+3=department
  const clause = `AND (
    LOWER(r.owner_email) = $${p}
    OR EXISTS (
      SELECT 1 FROM record_shares s
      WHERE s.record_id = r.id AND s.access_level <> 'none'
        AND (
          (s.principal_type = 'user'       AND LOWER(s.principal_id) = $${p})
          OR (s.principal_type = 'role'        AND s.principal_id = $${p + 1})
          OR (s.principal_type = 'role_group'  AND s.principal_id = ANY($${p + 2}))
          OR (s.principal_type = 'department'  AND s.principal_id = $${p + 3})
        )
    )
  )`;
  return { clause, params: [principals.email, principals.role, principals.groupIds, principals.department] };
}
