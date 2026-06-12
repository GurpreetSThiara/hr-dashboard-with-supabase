-- ============================================================================
-- HR APP FEATURE PACK 2 — 16 new tenant-scoped workspace modules
-- Run AFTER hr-features.sql. Idempotent and additive. All tables carry
-- organization_id for tenant isolation.
-- ============================================================================

DO $hr2$
DECLARE t TEXT;
  tables TEXT[] := ARRAY[
    'departments','locations','designations','job_openings','candidates','interviews',
    'shifts','travel_requests','advance_requests','grievances','suggestions','kb_articles',
    'handbook_policies','safety_incidents','vendors','referrals'
  ];
BEGIN
  CREATE TABLE IF NOT EXISTS departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL, head_email text, description text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL, city text, country text, timezone text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS designations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL, level text, department text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS job_openings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL, department text, location text, employment_type text, status text NOT NULL DEFAULT 'open',
    openings int NOT NULL DEFAULT 1, description text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL, email text, phone text, job_opening_id uuid, stage text NOT NULL DEFAULT 'applied',
    source text, notes text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS interviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    candidate_id uuid, interviewer_email text, scheduled_at timestamptz, mode text, status text NOT NULL DEFAULT 'scheduled',
    feedback text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL, start_time text, end_time text, days text, employee_id uuid, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS travel_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, requester_email text, destination text NOT NULL, purpose text, start_date date, end_date date,
    estimated_cost numeric, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS advance_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, requester_email text, amount numeric NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD',
    reason text, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS grievances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    raised_by text, category text, subject text NOT NULL, details text, status text NOT NULL DEFAULT 'open',
    confidential boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    submitted_by text, title text NOT NULL, details text, votes int NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS kb_articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL, category text, body text, published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS handbook_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL, category text, body text, version text, effective_date date, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS safety_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    reported_by text, location text, severity text, description text NOT NULL, status text NOT NULL DEFAULT 'reported',
    incident_date date, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS vendors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL, category text, contact_email text, phone text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    referrer_email text, candidate_name text NOT NULL, candidate_email text, position text, status text NOT NULL DEFAULT 'submitted',
    created_at timestamptz NOT NULL DEFAULT now());

  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id)', 'idx_'||t||'_org', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_read_own', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (organization_id = (SELECT organization_id FROM users WHERE users.id = auth.uid()))',
      t||'_read_own', t);
  END LOOP;
END
$hr2$;
