/**
 * Unified tenant context resolver.
 *
 * Computes everything the HR app needs to know about an organization's
 * Super-Owner-controlled state: lifecycle status, maintenance mode, the active
 * plan, EFFECTIVE modules (plan modules ± per-org overrides), seat usage vs the
 * plan limit, subscription expiry, branding, active announcements, and global
 * platform settings.
 *
 * This is the single source of truth that keeps the HR app in sync with the
 * Super Owner app. Both `/api/me/context` and the server-side guards use it.
 */
import { withPgClient } from '@/lib/pgClient';

export interface OrgContext {
  organizationId: string | null;
  isSuperOwner: boolean;
  status: string | null;                 // active | suspended | archived
  maintenanceMode: boolean;
  active: boolean;                        // status === 'active' && !expired
  plan: { code: string | null; name: string | null };
  modules: string[];                      // effective module codes
  seat: { used: number; limit: number | null; remaining: number | null };
  subscription: { endsAt: string | null; expired: boolean };
  branding: { name: string | null; primaryColor: string | null; logoUrl: string | null };
  announcements: Array<{ id: string; title: string; body: string | null; level: string }>;
  featureFlags: string[];                 // enabled global flag keys
  platform: { supportEmail: string | null };
}

/** Fire-and-forget: stamp the org's last activity. Never throws. */
export async function touchOrgActivity(organizationId: string | null): Promise<void> {
  if (!organizationId) return;
  try {
    await withPgClient(async (client) => {
      await client.query(`UPDATE organizations SET last_active_at = NOW() WHERE id = $1`, [organizationId]);
    });
  } catch { /* non-fatal */ }
}

export async function computeOrgContext(
  organizationId: string | null,
  isSuperOwner: boolean
): Promise<OrgContext> {
  return withPgClient(async (client) => {
    const settingsRes = await client.query(
      `SELECT support_email FROM platform_settings WHERE id = 'global'`
    ).catch(() => ({ rows: [] as any[] }));
    const supportEmail = settingsRes.rows[0]?.support_email ?? null;

    if (isSuperOwner || !organizationId) {
      return {
        organizationId: null, isSuperOwner, status: null, maintenanceMode: false, active: true,
        plan: { code: null, name: null }, modules: [],
        seat: { used: 0, limit: null, remaining: null },
        subscription: { endsAt: null, expired: false },
        branding: { name: null, primaryColor: null, logoUrl: null },
        announcements: [], featureFlags: [], platform: { supportEmail },
      };
    }

    const flagsRes = await client
      .query(`SELECT key FROM platform_feature_flags WHERE enabled = true`)
      .catch(() => ({ rows: [] as any[] }));
    const featureFlags = flagsRes.rows.map((r: any) => r.key);

    const [orgRes, subRes, planModRes, ovRes, seatRes, annRes] = await Promise.all([
      client.query(
        `SELECT name, status, maintenance_mode, primary_color, logo_url
           FROM organizations WHERE id = $1`, [organizationId]),
      client.query(
        `SELECT os.ends_at, p.code, p.name, p.limits
           FROM organization_subscriptions os JOIN plans p ON p.id = os.plan_id
          WHERE os.organization_id = $1 AND os.status = 'active' LIMIT 1`, [organizationId]),
      client.query(
        `SELECT m.code FROM organization_subscriptions os
           JOIN plan_modules pm ON pm.plan_id = os.plan_id
           JOIN modules m ON m.id = pm.module_id
          WHERE os.organization_id = $1 AND os.status = 'active'`, [organizationId]),
      client.query(
        `SELECT module_code, enabled FROM organization_module_overrides WHERE organization_id = $1`,
        [organizationId]).catch(() => ({ rows: [] as any[] })),
      client.query(
        `SELECT count(*)::int n FROM employees WHERE organization_id = $1 AND deleted_at IS NULL`,
        [organizationId]).catch(async () =>
          client.query(`SELECT count(*)::int n FROM employees WHERE organization_id = $1`, [organizationId])),
      client.query(
        `SELECT id, title, body, level FROM platform_announcements
          WHERE is_active = true
            AND (scope = 'global' OR organization_id = $1)
            AND starts_at <= NOW()
            AND (ends_at IS NULL OR ends_at >= NOW())
          ORDER BY created_at DESC`, [organizationId]).catch(() => ({ rows: [] as any[] })),
    ]);

    const org = orgRes.rows[0] ?? {};
    const sub = subRes.rows[0] ?? {};

    // Effective modules = plan modules − disabled overrides + enabled overrides.
    const set = new Set<string>(planModRes.rows.map((r: any) => r.code));
    for (const o of ovRes.rows) {
      if (o.enabled) set.add(o.module_code);
      else set.delete(o.module_code);
    }

    const limitRaw = sub.limits?.max_employees;
    const limit = typeof limitRaw === 'number' ? limitRaw : null;
    const used = seatRes.rows[0]?.n ?? 0;

    const endsAt = sub.ends_at ? new Date(sub.ends_at).toISOString() : null;
    const expired = !!sub.ends_at && new Date(sub.ends_at).getTime() < Date.now();

    return {
      organizationId,
      isSuperOwner: false,
      status: org.status ?? null,
      maintenanceMode: !!org.maintenance_mode,
      active: org.status === 'active' && !expired,
      plan: { code: sub.code ?? null, name: sub.name ?? null },
      modules: Array.from(set).sort(),
      seat: { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) },
      subscription: { endsAt, expired },
      branding: { name: org.name ?? null, primaryColor: org.primary_color ?? null, logoUrl: org.logo_url ?? null },
      announcements: annRes.rows,
      featureFlags,
      platform: { supportEmail },
    };
  });
}
