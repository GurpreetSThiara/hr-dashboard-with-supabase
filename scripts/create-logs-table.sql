-- Create check-in/check-out logs table if not exists
CREATE TABLE IF NOT EXISTS checkin_checkout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  location VARCHAR,
  device VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  sessions JSONB DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE checkin_checkout_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "logs_select_own" ON checkin_checkout_logs;
CREATE POLICY "logs_select_own" ON checkin_checkout_logs
  FOR SELECT USING (
    employee_id = (SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = auth.uid()))
    OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager')
    )
  );

DROP POLICY IF EXISTS "logs_insert_own" ON checkin_checkout_logs;
CREATE POLICY "logs_insert_own" ON checkin_checkout_logs
  FOR INSERT WITH CHECK (
    employee_id = (SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "logs_update_own" ON checkin_checkout_logs;
CREATE POLICY "logs_update_own" ON checkin_checkout_logs
  FOR UPDATE USING (
    employee_id = (SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = auth.uid()))
    OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager')
    )
  );

-- Create index
CREATE INDEX IF NOT EXISTS idx_checkin_employee_date ON checkin_checkout_logs(employee_id, check_in_time);
