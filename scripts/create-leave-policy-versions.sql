-- Leave Policy Versioning
-- Run this script in your Supabase SQL editor (or via POSTGRES_URL).
-- It adds versioned policy support on top of the existing leave_types table.

-- ── Policy version containers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_policy_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  description     TEXT,
  effective_date  DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'active', 'superseded')),
  is_active       BOOLEAN     NOT NULL DEFAULT false,
  created_by_email    TEXT,
  activated_by_email  TEXT,
  activated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active version at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_policy
  ON leave_policy_versions (is_active)
  WHERE is_active = true;

-- ── Per-version rules (one row per leave_type per version) ───────────────────
CREATE TABLE IF NOT EXISTS leave_policy_rules (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id            UUID    NOT NULL REFERENCES leave_policy_versions(id) ON DELETE CASCADE,
  leave_type_id         UUID    NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  leave_type_name       TEXT    NOT NULL,
  days_per_year         INTEGER NOT NULL DEFAULT 0,
  carry_forward_allowed BOOLEAN NOT NULL DEFAULT false,
  max_carry_forward     INTEGER NOT NULL DEFAULT 0,
  gender_specific       TEXT    CHECK (gender_specific IN ('male', 'female', NULL)),
  requires_document     BOOLEAN NOT NULL DEFAULT false,
  pro_rata              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(version_id, leave_type_id)
);

CREATE INDEX IF NOT EXISTS idx_leave_policy_rules_version ON leave_policy_rules(version_id);

-- ── RLS: allow authenticated reads, admin-only writes ───────────────────────
ALTER TABLE leave_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policy_rules    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lpv_read  ON leave_policy_versions;
DROP POLICY IF EXISTS lpv_write ON leave_policy_versions;
DROP POLICY IF EXISTS lpr_read  ON leave_policy_rules;
DROP POLICY IF EXISTS lpr_write ON leave_policy_rules;

CREATE POLICY lpv_read  ON leave_policy_versions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY lpv_write ON leave_policy_versions FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY lpr_read  ON leave_policy_rules    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY lpr_write ON leave_policy_rules    FOR ALL    USING (auth.role() = 'authenticated');

-- ── Extend leave_requests for admin edits ───────────────────────────────────
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approver_email TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS days_count     INTEGER DEFAULT 1;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS employee_email TEXT;
