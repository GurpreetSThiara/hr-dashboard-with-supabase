/**
 * Generic administrative audit trail.
 *
 * Every privileged configuration change (permissions, role changes, leave/holiday
 * config, delegations, etc.) should call `logAdminAction`. It records who/when/
 * what + old→new values + IP + user-agent and NEVER throws (auditing must not
 * break the primary action).
 *
 * Two usage modes:
 *  - Inside an existing withPgClient tx: pass the `client`.
 *  - Standalone (most admin routes): omit `client`; it opens its own connection
 *    fire-and-forget.
 */
import type { NextRequest } from 'next/server';
import { withPgClient } from '@/lib/pgClient';

export interface AdminAuditInput {
  /** Any actor shape with an email + role (ActorContext or AuthedActor). */
  actor: { email: string; role: string };
  action: string;          // e.g. 'permission_matrix.update', 'user.role_change'
  entityType?: string;     // e.g. 'role_permissions', 'user'
  entityId?: string | null;
  summary?: string | null;
  oldValue?: any;
  newValue?: any;
  request?: NextRequest;
}

function clientMeta(request?: NextRequest) {
  if (!request) return { ip: null as string | null, ua: null as string | null };
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;
  return { ip, ua: request.headers.get('user-agent') || null };
}

async function insert(client: any, input: AdminAuditInput) {
  const { ip, ua } = clientMeta(input.request);
  await client.query(
    `INSERT INTO admin_audit_log
       (actor_email, actor_role, action, entity_type, entity_id, summary, old_value, new_value, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      input.actor.email,
      input.actor.role,
      input.action,
      input.entityType ?? null,
      input.entityId ?? null,
      input.summary ?? null,
      input.oldValue != null ? JSON.stringify(input.oldValue) : null,
      input.newValue != null ? JSON.stringify(input.newValue) : null,
      ip,
      ua,
    ]
  );
}

/** Log within an existing transaction (pass the pg client). Never throws. */
export async function logAdminActionTx(client: any, input: AdminAuditInput): Promise<void> {
  try {
    await insert(client, input);
  } catch (err) {
    console.error('[adminAudit] tx write failed (non-fatal):', (err as Error).message);
  }
}

/** Standalone log (opens its own connection). Fire-and-forget; never throws. */
export function logAdminAction(input: AdminAuditInput): void {
  withPgClient((client) => insert(client, input)).catch((err) => {
    console.error('[adminAudit] write failed (non-fatal):', err?.message);
  });
}
