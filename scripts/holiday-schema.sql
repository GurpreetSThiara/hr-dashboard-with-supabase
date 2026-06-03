-- ── Holiday Management System ────────────────────────────────────────────────

-- 1. Company holidays (the actual calendar dates)
CREATE TABLE IF NOT EXISTS company_holidays (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  date          date        NOT NULL,
  year          integer     GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)::integer) STORED,
  holiday_type  text        NOT NULL DEFAULT 'mandatory'
                            CHECK (holiday_type IN ('mandatory', 'optional')),
  description   text,
  is_recurring  boolean     NOT NULL DEFAULT false,   -- repeats every year on same M/D
  is_archived   boolean     NOT NULL DEFAULT false,
  country_code  text,                                  -- e.g. 'IN', 'US'
  region        text,                                  -- e.g. 'MH', 'CA'
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, name)
);

-- 2. Holiday policies (named calendar bundles)
CREATE TABLE IF NOT EXISTS holiday_policies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  description text,
  is_default  boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Which holidays are in which policy
CREATE TABLE IF NOT EXISTS holiday_policy_holidays (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id  uuid NOT NULL REFERENCES holiday_policies(id) ON DELETE CASCADE,
  holiday_id uuid NOT NULL REFERENCES company_holidays(id) ON DELETE CASCADE,
  UNIQUE (policy_id, holiday_id)
);

-- 4. Policy assignments — link a policy to a scope
CREATE TABLE IF NOT EXISTS holiday_policy_assignments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id        uuid        NOT NULL REFERENCES holiday_policies(id) ON DELETE CASCADE,
  assignment_type  text        NOT NULL CHECK (assignment_type IN ('company','department','location','employee')),
  assignment_value text        NOT NULL,   -- dept name / location / employee_id / '*'
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_type, assignment_value)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(date);
CREATE INDEX IF NOT EXISTS idx_company_holidays_year ON company_holidays(year);
CREATE INDEX IF NOT EXISTS idx_company_holidays_type ON company_holidays(holiday_type);
CREATE INDEX IF NOT EXISTS idx_holiday_policy_assignments_policy ON holiday_policy_assignments(policy_id);

-- ── Overlap prevention for leave_requests ────────────────────────────────────
-- DB-level function to check for overlapping approved/pending leaves
CREATE OR REPLACE FUNCTION check_leave_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  conflict_id   uuid;
  conflict_type text;
  conflict_start date;
  conflict_end   date;
BEGIN
  -- Only check pending and approved statuses for overlap
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT id, leave_type, start_date, end_date
  INTO   conflict_id, conflict_type, conflict_start, conflict_end
  FROM   leave_requests
  WHERE  employee_id = NEW.employee_id
    AND  id          != NEW.id          -- exclude self (for UPDATEs)
    AND  status      IN ('pending','approved')
    AND  start_date  <= NEW.end_date
    AND  end_date    >= NEW.start_date
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Leave conflict: you already have a % leave from % to % that overlaps with the requested dates',
      conflict_type,
      TO_CHAR(conflict_start, 'DD Mon YYYY'),
      TO_CHAR(conflict_end,   'DD Mon YYYY')
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_overlap ON leave_requests;
CREATE TRIGGER trg_leave_overlap
  BEFORE INSERT OR UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION check_leave_overlap();

-- ── Seed: default holiday policy ─────────────────────────────────────────────
INSERT INTO holiday_policies (name, description, is_default, is_active, created_by)
VALUES ('India Corporate Calendar', 'Standard public holidays for India corporate offices', true, true, 'system')
ON CONFLICT (name) DO NOTHING;

-- Seed common Indian public holidays for the current year
DO $$
DECLARE
  yr  integer := EXTRACT(YEAR FROM now())::integer;
  pid uuid;
BEGIN
  SELECT id INTO pid FROM holiday_policies WHERE name = 'India Corporate Calendar';

  -- Insert holidays (year-agnostic recurring ones)
  WITH ins AS (
    INSERT INTO company_holidays (name, date, holiday_type, is_recurring, country_code, created_by) VALUES
      ('New Year''s Day',              (yr||'-01-01')::date, 'mandatory', true, 'IN', 'system'),
      ('Republic Day',                 (yr||'-01-26')::date, 'mandatory', true, 'IN', 'system'),
      ('Holi',                         (yr||'-03-25')::date, 'optional',  true, 'IN', 'system'),
      ('Good Friday',                  (yr||'-04-18')::date, 'optional',  true, 'IN', 'system'),
      ('Ambedkar Jayanti',             (yr||'-04-14')::date, 'mandatory', true, 'IN', 'system'),
      ('Labour Day',                   (yr||'-05-01')::date, 'mandatory', true, 'IN', 'system'),
      ('Independence Day',             (yr||'-08-15')::date, 'mandatory', true, 'IN', 'system'),
      ('Gandhi Jayanti',               (yr||'-10-02')::date, 'mandatory', true, 'IN', 'system'),
      ('Dussehra',                     (yr||'-10-02')::date, 'optional',  true, 'IN', 'system'),
      ('Diwali',                       (yr||'-10-20')::date, 'mandatory', true, 'IN', 'system'),
      ('Christmas Day',                (yr||'-12-25')::date, 'mandatory', true, 'IN', 'system')
    ON CONFLICT (date, name) DO NOTHING
    RETURNING id
  )
  INSERT INTO holiday_policy_holidays (policy_id, holiday_id)
  SELECT pid, id FROM ins
  ON CONFLICT DO NOTHING;

END;
$$;

-- Assign default policy company-wide
INSERT INTO holiday_policy_assignments (policy_id, assignment_type, assignment_value, created_by)
SELECT id, 'company', '*', 'system'
FROM   holiday_policies
WHERE  name = 'India Corporate Calendar'
ON CONFLICT (assignment_type, assignment_value) DO NOTHING;

-- RLS
ALTER TABLE company_holidays              ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_policies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_policy_holidays       ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_policy_assignments    ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all
CREATE POLICY "holiday_read" ON company_holidays              FOR SELECT TO authenticated USING (true);
CREATE POLICY "policy_read"  ON holiday_policies              FOR SELECT TO authenticated USING (true);
CREATE POLICY "pph_read"     ON holiday_policy_holidays       FOR SELECT TO authenticated USING (true);
CREATE POLICY "hpa_read"     ON holiday_policy_assignments    FOR SELECT TO authenticated USING (true);

