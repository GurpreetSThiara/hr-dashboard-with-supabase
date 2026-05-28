-- ============================================================================
-- ROLE PERMISSIONS TABLE
-- Run this in Supabase SQL editor once to enable dynamic permission management.
-- After running, the Admin Panel → Roles & Permissions tab will persist changes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission TEXT NOT NULL,
  tier INTEGER NOT NULL,
  role_name TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(permission, tier)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for runtime permission checks)
CREATE POLICY "rp_select_all" ON role_permissions
  FOR SELECT USING (true);

-- Only tier ≤ 2 (Super Admin / Owner) can write
CREATE POLICY "rp_write_admin" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND tier <= 2
    )
  );

CREATE INDEX IF NOT EXISTS idx_rp_tier ON role_permissions(tier);
CREATE INDEX IF NOT EXISTS idx_rp_permission ON role_permissions(permission);
