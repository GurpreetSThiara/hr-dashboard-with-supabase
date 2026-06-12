-- ============================================================================
-- SUPER OWNER FEATURE PACK 2 (features 11–30) — schema additions
-- Run AFTER super-owner-features.sql. Idempotent and additive.
-- ============================================================================

-- F11: plan pricing
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_monthly NUMERIC;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_yearly  NUMERIC;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency      TEXT NOT NULL DEFAULT 'USD';

-- F20/F24: organization suspend reason + last-active tracking
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_active_at   TIMESTAMPTZ;

-- F21: global feature flags
CREATE TABLE IF NOT EXISTS platform_feature_flags (
  key         TEXT        PRIMARY KEY,
  description TEXT,
  enabled     BOOLEAN     NOT NULL DEFAULT false,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_feature_flags (key, description, enabled) VALUES
  ('beta_analytics',     'Expose beta analytics dashboards in the HR app', false),
  ('self_service_signup','Allow organizations to self-register',           false)
ON CONFLICT (key) DO NOTHING;

-- Seed sensible default pricing for the demo plans
UPDATE plans SET price_monthly = 0,   price_yearly = 0    WHERE code = 'free'       AND price_monthly IS NULL;
UPDATE plans SET price_monthly = 49,  price_yearly = 490  WHERE code = 'pro'        AND price_monthly IS NULL;
UPDATE plans SET price_monthly = 199, price_yearly = 1990 WHERE code = 'enterprise' AND price_monthly IS NULL;

-- RLS: feature flags readable by authenticated users (HR reads them via context)
ALTER TABLE platform_feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pff_read ON platform_feature_flags;
CREATE POLICY pff_read ON platform_feature_flags FOR SELECT TO authenticated USING (true);
