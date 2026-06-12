-- ============================================================================
-- MIGRATION: Backfill existing data into a default Organization
-- Phase 1 of the Super Owner / multi-tenant refactor.
--
-- PREREQUISITE: run scripts/create-organizations.sql first.
-- SAFETY:
--   * Take a backup first:  pg_dump "$POSTGRES_URL" > pre_multitenant.sql
--   * Runs inside a single transaction — any failure rolls back everything.
--   * Idempotent: ADD COLUMN IF NOT EXISTS, guarded FK/constraint creation,
--     backfill only touches NULL rows.
--   * Validation gate RAISES EXCEPTION (aborting the tx) if any tenant row
--     would be left orphaned, BEFORE constraints are tightened.
--
-- Strategy: add nullable organization_id everywhere -> create default org ->
-- backfill -> validate no orphans -> enforce NOT NULL + FK + indexes.
-- `users.organization_id` stays NULLABLE because Super Owner belongs to no org.
-- ============================================================================

BEGIN;

-- Tenant-owned tables that must carry organization_id and become NOT NULL.
-- (users is handled separately because it stays nullable for Super Owner.)
DO $migrate$
DECLARE
  tenant_tables TEXT[] := ARRAY[
    'employees', 'leave_requests', 'attendance_records', 'attendance_regularizations',
    'checkin_checkout_logs', 'leave_types', 'leave_policies', 'leave_policy_versions',
    'leave_policy_rules', 'company_holidays', 'holiday_policies', 'holiday_policy_holidays',
    'holiday_policy_assignments', 'activity_feed', 'clients', 'projects', 'tasks',
    'time_entries', 'timesheets', 'billing_rates', 'custom_objects', 'custom_fields',
    'field_permissions', 'role_permissions', 'permission_sets', 'permission_set_assignments',
    'role_groups', 'role_group_members', 'leave_visibility_config', 'leave_approval_config',
    'leave_approval_delegates', 'leave_audit_log', 'admin_audit_log', 'employee_audit_log',
    'attendance_settings'
  ];
  t            TEXT;
  v_org_id     UUID;
  v_plan_id    UUID;
  v_exists     BOOLEAN;
  v_orphans    BIGINT;
BEGIN
  -- Backfilling organization_id is a data-migration UPDATE; business-rule
  -- triggers (e.g. the leave-overlap guard on leave_requests) must not fire or
  -- they will reject the bulk update. session_replication_role = replica
  -- disables user triggers for this transaction only (SET LOCAL reverts on exit).
  SET LOCAL session_replication_role = replica;

  -- ── Step 1: add nullable organization_id + index to every existing tenant table
  FOREACH t IN ARRAY tenant_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) INTO v_exists;

    IF v_exists THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID', t);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id)',
        'idx_' || t || '_org', t);
      RAISE NOTICE 'Prepared tenant table: %', t;
    ELSE
      RAISE NOTICE 'Skipped (does not exist): %', t;
    END IF;
  END LOOP;

  -- users: add nullable organization_id (NULL is allowed = Super Owner / platform)
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS organization_id UUID;
  CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(organization_id);

  -- ── Step 2: create the default "Migrated Organization"
  INSERT INTO organizations (name, slug, status, created_by)
  VALUES ('Migrated Organization', 'migrated', 'active', 'system')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_org_id FROM organizations WHERE slug = 'migrated';
  RAISE NOTICE 'Default organization id: %', v_org_id;

  -- ── Step 3: give it an active Enterprise subscription (all modules) so the
  --            migrated tenant retains access to every feature it had before.
  SELECT id INTO v_plan_id FROM plans WHERE code = 'enterprise';
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Enterprise plan missing — run create-organizations.sql first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_subscriptions
    WHERE organization_id = v_org_id AND status = 'active'
  ) THEN
    INSERT INTO organization_subscriptions (organization_id, plan_id, status)
    VALUES (v_org_id, v_plan_id, 'active');
  END IF;

  -- ── Step 4: backfill organization_id on every NULL row (existing data)
  FOREACH t IN ARRAY tenant_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) INTO v_exists;
    IF v_exists THEN
      EXECUTE format(
        'UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', t)
        USING v_org_id;
    END IF;
  END LOOP;

  -- All existing users join the migrated org, EXCEPT any platform Super Owner
  -- (role 'Super Owner' stays org-less). This makes the migration safe to run
  -- even if a demo Super Owner was already seeded.
  UPDATE public.users
     SET organization_id = v_org_id
   WHERE organization_id IS NULL
     AND role <> 'Super Owner';

  -- ── Step 5: VALIDATION GATE — abort if any tenant row is still orphaned.
  FOREACH t IN ARRAY tenant_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) INTO v_exists;
    IF v_exists THEN
      EXECUTE format(
        'SELECT count(*) FROM public.%I WHERE organization_id IS NULL', t)
        INTO v_orphans;
      IF v_orphans > 0 THEN
        RAISE EXCEPTION 'Migration aborted: % orphaned rows in % after backfill',
          v_orphans, t;
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'Validation passed: no orphaned tenant rows.';

  -- ── Step 6: enforce NOT NULL + FK on tenant tables (users excluded).
  FOREACH t IN ARRAY tenant_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) INTO v_exists;
    IF v_exists THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
      -- Add FK only if it does not already exist.
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_' || t || '_org'
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I
             FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE',
          t, 'fk_' || t || '_org');
      END IF;
    END IF;
  END LOOP;

  -- users keeps organization_id NULLABLE; add the FK only.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_org') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT fk_users_org
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;

  RAISE NOTICE 'Migration complete. All tenant data assigned to org %.', v_org_id;
END
$migrate$;

-- Org-scoped read policies for the browser client (now that users.organization_id
-- exists). Super Owner (organization_id IS NULL) is handled in app code.
DROP POLICY IF EXISTS org_read_own ON organizations;
CREATE POLICY org_read_own ON organizations
  FOR SELECT TO authenticated USING (
    id = (SELECT organization_id FROM users WHERE users.id = auth.uid())
  );

DROP POLICY IF EXISTS org_sub_read_own ON organization_subscriptions;
CREATE POLICY org_sub_read_own ON organization_subscriptions
  FOR SELECT TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE users.id = auth.uid())
  );

COMMIT;

-- ============================================================================
-- POST-MIGRATION (run manually, deliberately):
--
-- 1) Promote a chosen account to the platform Super Owner (no organization):
--      UPDATE users
--      SET role = 'Super Owner', tier = 0, organization_id = NULL
--      WHERE email = 'owner@yourplatform.com';
--
-- 2) Per-org unique constraints (DEFERRED — review before running; these
--    relax current GLOBAL uniques to per-tenant. Only safe once you intend to
--    allow the same emp_id/email across different orgs):
--      ALTER TABLE employees   DROP CONSTRAINT IF EXISTS employees_emp_id_key;
--      ALTER TABLE employees   ADD  CONSTRAINT employees_org_emp_id_uniq UNIQUE (organization_id, emp_id);
--      ALTER TABLE employees   DROP CONSTRAINT IF EXISTS employees_email_key;
--      ALTER TABLE employees   ADD  CONSTRAINT employees_org_email_uniq  UNIQUE (organization_id, email);
--      -- repeat for users.email, leave_types.name, holiday_policies.name, etc.
-- ============================================================================
