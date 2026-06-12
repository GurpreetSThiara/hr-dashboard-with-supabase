-- ============================================================================
-- MULTI-TENANT FOUNDATION: Organizations, Plans, Modules, Subscriptions
-- Phase 1 of the Super Owner / multi-tenant refactor.
--
-- Run this BEFORE scripts/migrate-to-multi-tenant.sql.
-- Idempotent: safe to re-run. Creates no destructive changes.
-- ============================================================================

-- ── 1. ORGANIZATIONS (tenants) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'archived')),
  created_by  TEXT,                       -- email of the Super Owner who created it
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. PLANS (subscription tiers) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,   -- 'free', 'pro', 'enterprise'
  name        TEXT        NOT NULL,
  description TEXT,
  limits      JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- e.g. {"max_employees": 50}
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. MODULES (feature areas that plans can enable) ────────────────────────
CREATE TABLE IF NOT EXISTS modules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,   -- 'employees','leave','attendance','time_tracking','analytics','admin','organization'
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. PLAN_MODULES (which modules each plan enables) ───────────────────────
CREATE TABLE IF NOT EXISTS plan_modules (
  plan_id    UUID NOT NULL REFERENCES plans(id)   ON DELETE CASCADE,
  module_id  UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, module_id)
);

-- ── 5. ORGANIZATION_SUBSCRIPTIONS (org → plan, one active at a time) ────────
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id         UUID        NOT NULL REFERENCES plans(id),
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'cancelled', 'expired')),
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce at most one ACTIVE subscription per organization.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_subscription
  ON organization_subscriptions (organization_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_org_subs_org ON organization_subscriptions(organization_id);

-- ── 6. SEED: module catalog (matches current feature areas / navItems) ──────
INSERT INTO modules (code, name, description) VALUES
  ('employees',      'Employee Management', 'Employee directory and records'),
  ('leave',          'Leave Management',    'Leave requests, policies, balances'),
  ('attendance',     'Attendance',          'Attendance records, check-in/out, regularizations'),
  ('time_tracking',  'Time Tracking',       'Timesheets, projects, tasks, billing'),
  ('analytics',      'Analytics',           'Headcount and leave analytics dashboards'),
  ('organization',   'Organization',        'Org chart, policies, overview'),
  ('admin',          'Administration',      'Roles, permissions, custom objects, settings')
ON CONFLICT (code) DO NOTHING;

-- ── 7. SEED: default plans ──────────────────────────────────────────────────
INSERT INTO plans (code, name, description, limits) VALUES
  ('free',       'Free',       'Basic HR features',        '{"max_employees": 25}'::jsonb),
  ('pro',        'Pro',        'Full HR suite',            '{"max_employees": 250}'::jsonb),
  ('enterprise', 'Enterprise', 'All modules, no limits',   '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Map modules to plans.
-- free: employees + leave only
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
WHERE p.code = 'free' AND m.code IN ('employees','leave')
ON CONFLICT DO NOTHING;

-- pro: everything except admin's heavier customization (still gets admin)
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
WHERE p.code = 'pro'
  AND m.code IN ('employees','leave','attendance','time_tracking','analytics','organization','admin')
ON CONFLICT DO NOTHING;

-- enterprise: all modules
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
WHERE p.code = 'enterprise'
ON CONFLICT DO NOTHING;

-- ── 8. RLS (defense-in-depth for direct Supabase JS client) ─────────────────
-- NOTE: API routes use withPgClient (superuser) and bypass RLS. Real
-- enforcement of Super-Owner-only writes lives in app code (requireSuperOwner).
-- These policies protect the browser anon client.
ALTER TABLE organizations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_modules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans & modules are a global catalog: readable by any authenticated user
-- (the frontend needs them to know which modules its org has).
DROP POLICY IF EXISTS plans_read   ON plans;
DROP POLICY IF EXISTS modules_read ON modules;
DROP POLICY IF EXISTS pm_read      ON plan_modules;
CREATE POLICY plans_read   ON plans         FOR SELECT TO authenticated USING (true);
CREATE POLICY modules_read ON modules       FOR SELECT TO authenticated USING (true);
CREATE POLICY pm_read      ON plan_modules  FOR SELECT TO authenticated USING (true);

-- NOTE: the org_read_own / org_sub_read_own policies depend on
-- users.organization_id, which is added by migrate-to-multi-tenant.sql. They are
-- therefore created at the END of that migration, not here.
