-- ============================================================================
-- HR APP FEATURE PACK (20 features) — tenant-scoped schema
-- Run AFTER the multi-tenant migration. Idempotent and additive.
-- Every table carries organization_id (tenant isolation).
-- ============================================================================

-- Self-service employee profile fields (F: profile edit, birthdays)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone             TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address           TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bio               TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth     DATE;

DO $hr$
DECLARE t TEXT;
  tables TEXT[] := ARRAY[
    'company_announcements','announcement_acks','recognition','company_events',
    'surveys','survey_votes','hr_tickets','ticket_comments','hr_notifications',
    'personal_tasks','employee_documents','assets','expense_claims','goals',
    'training_records','onboarding_tasks','employee_skills','exit_requests'
  ];
BEGIN
  -- Create tables --------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS company_announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL, body text, pinned boolean NOT NULL DEFAULT false, author_email text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS announcement_acks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    announcement_id uuid NOT NULL REFERENCES company_announcements(id) ON DELETE CASCADE, user_email text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(announcement_id, user_email));

  CREATE TABLE IF NOT EXISTS recognition (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_email text, to_employee_id uuid, message text NOT NULL, badge text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS company_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL, description text, event_date date NOT NULL, location text, created_by text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS surveys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title text NOT NULL, options jsonb NOT NULL DEFAULT '[]', is_open boolean NOT NULL DEFAULT true, created_by text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS survey_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE, user_email text NOT NULL, option_index int NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(survey_id, user_email));

  CREATE TABLE IF NOT EXISTS hr_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requester_email text, subject text NOT NULL, body text, category text, priority text NOT NULL DEFAULT 'normal',
    status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS ticket_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ticket_id uuid NOT NULL REFERENCES hr_tickets(id) ON DELETE CASCADE, author_email text, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS hr_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_email text NOT NULL, title text NOT NULL, body text, is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS personal_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_email text NOT NULL, title text NOT NULL, is_done boolean NOT NULL DEFAULT false, due_date date, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS employee_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, name text NOT NULL, category text, url text, uploaded_by text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL, tag text, category text, status text NOT NULL DEFAULT 'available', assigned_to_employee_id uuid, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS expense_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, employee_email text, title text NOT NULL, amount numeric NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD',
    category text, status text NOT NULL DEFAULT 'pending', notes text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, title text NOT NULL, description text, progress int NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active', due_date date, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS training_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, course text NOT NULL, provider text, completed_on date, expires_on date, status text NOT NULL DEFAULT 'in_progress', created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS onboarding_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, title text NOT NULL, is_done boolean NOT NULL DEFAULT false, due_date date, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS employee_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, skill text NOT NULL, level text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE TABLE IF NOT EXISTS exit_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id uuid, reason text, last_working_day date, status text NOT NULL DEFAULT 'initiated', created_at timestamptz NOT NULL DEFAULT now());

  -- Indexes + RLS -------------------------------------------------------------
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id)', 'idx_'||t||'_org', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_read_own', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (organization_id = (SELECT organization_id FROM users WHERE users.id = auth.uid()))',
      t||'_read_own', t);
  END LOOP;
END
$hr$;
