/** Best-effort platform audit logging. Never throws (won't break the action). */
export async function logAudit(
  client: any,
  actorEmail: string | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  detail?: any
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO platform_audit_log (actor_email, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorEmail, action, targetType, targetId, detail != null ? JSON.stringify(detail) : null]
    );
  } catch (e) {
    console.error('[audit] failed (non-fatal):', (e as Error).message);
  }
}
