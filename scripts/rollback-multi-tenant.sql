-- ============================================================================
-- ROLLBACK: undo scripts/migrate-to-multi-tenant.sql and create-organizations.sql
--
-- Use this only if you need to revert the Phase 1 multi-tenant migration.
-- Preferred recovery is restoring the pre-migration pg_dump. This script is the
-- in-place fallback: it drops the organization_id columns/constraints and the
-- new tables. It does NOT delete any business rows.
--
-- Runs in a single transaction.
-- ============================================================================

BEGIN;

DO $rollback$
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
    'attendance_settings', 'users'
  ];
  t        TEXT;
  v_exists BOOLEAN;
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) INTO v_exists;
    IF v_exists THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, 'fk_' || t || '_org');
      EXECUTE format('DROP INDEX IF EXISTS public.%I', 'idx_' || t || '_org');
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS organization_id', t);
      RAISE NOTICE 'Reverted tenant table: %', t;
    END IF;
  END LOOP;
END
$rollback$;

-- Drop the multi-tenant catalog tables (children first).
DROP TABLE IF EXISTS organization_subscriptions CASCADE;
DROP TABLE IF EXISTS plan_modules               CASCADE;
DROP TABLE IF EXISTS modules                    CASCADE;
DROP TABLE IF EXISTS plans                       CASCADE;
DROP TABLE IF EXISTS organizations              CASCADE;

COMMIT;
