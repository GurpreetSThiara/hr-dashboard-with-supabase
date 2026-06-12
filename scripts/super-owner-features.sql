-- ============================================================================
-- SUPER OWNER FEATURE PACK (10 features) — schema additions
-- Run AFTER create-organizations.sql + migrate-to-multi-tenant.sql.
-- Idempotent and additive. Safe to re-run.
-- ============================================================================

-- F1/F2/F7/F8-meta: organization columns (lifecycle, maintenance, branding, notes)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url              TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color         TEXT NOT NULL DEFAULT '#4f46e5';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notes                 TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_contact_email TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS maintenance_mode      BOOLEAN NOT NULL DEFAULT false;

-- F4: per-organization module overrides (add-on = enabled true, disable = false)
CREATE TABLE IF NOT EXISTS organization_module_overrides (
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_code     TEXT        NOT NULL,
  enabled         BOOLEAN     NOT NULL,
  updated_by      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, module_code)
);

-- F6: platform announcements (global or per-organization)
CREATE TABLE IF NOT EXISTS platform_announcements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           TEXT        NOT NULL DEFAULT 'global' CHECK (scope IN ('global','organization')),
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  body            TEXT,
  level           TEXT        NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','critical')),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON platform_announcements(is_active, scope);

-- F8: platform audit log (Super Owner actions)
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT,
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_log(created_at DESC);

-- F9: global platform settings (single row)
CREATE TABLE IF NOT EXISTS platform_settings (
  id                TEXT        PRIMARY KEY DEFAULT 'global',
  signups_enabled   BOOLEAN     NOT NULL DEFAULT true,
  default_plan_code TEXT,
  support_email     TEXT,
  updated_by        TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_settings (id, default_plan_code, support_email)
VALUES ('global', 'free', 'support@platform.io')
ON CONFLICT (id) DO NOTHING;

-- RLS (defense-in-depth; API uses superuser and bypasses these)
ALTER TABLE organization_module_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings             ENABLE ROW LEVEL SECURITY;

-- A tenant user may read overrides/announcements relevant to their own org.
DROP POLICY IF EXISTS omo_read_own ON organization_module_overrides;
CREATE POLICY omo_read_own ON organization_module_overrides
  FOR SELECT TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE users.id = auth.uid())
  );

DROP POLICY IF EXISTS ann_read ON platform_announcements;
CREATE POLICY ann_read ON platform_announcements
  FOR SELECT TO authenticated USING (
    is_active = true AND (
      scope = 'global'
      OR organization_id = (SELECT organization_id FROM users WHERE users.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS settings_read ON platform_settings;
CREATE POLICY settings_read ON platform_settings FOR SELECT TO authenticated USING (true);
