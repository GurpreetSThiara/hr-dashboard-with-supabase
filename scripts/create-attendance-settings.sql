-- 1. Create attendance settings table
CREATE TABLE IF NOT EXISTS attendance_settings (
  id VARCHAR(50) PRIMARY KEY,
  max_past_days_regularization INTEGER DEFAULT 30,
  checkin_checkout_allowed_tiers INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  enable_checkin_checkout BOOLEAN DEFAULT true,
  enable_regularizations BOOLEAN DEFAULT true,
  updated_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO attendance_settings (id, max_past_days_regularization, checkin_checkout_allowed_tiers, enable_checkin_checkout, enable_regularizations, updated_by)
VALUES ('default', 30, ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18], true, true, 'system')
ON CONFLICT (id) DO NOTHING;

-- 2. Create attendance regularizations table
CREATE TABLE IF NOT EXISTS attendance_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  employee_name TEXT NOT NULL,
  date DATE NOT NULL,
  requested_check_in TIMESTAMP WITH TIME ZONE,
  requested_check_out TIMESTAMP WITH TIME ZONE,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  approver_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- 3. Enable RLS on both tables
ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_regularizations ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for settings
-- Everyone can read settings
DROP POLICY IF EXISTS "settings_select_all" ON attendance_settings;
CREATE POLICY "settings_select_all" ON attendance_settings
  FOR SELECT USING (true);

-- Only Super Admin/Owner can write settings
DROP POLICY IF EXISTS "settings_write_admin" ON attendance_settings;
CREATE POLICY "settings_write_admin" ON attendance_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.tier <= 2
    )
  );

-- 5. RLS policies for regularizations
-- Everyone can read their own regularizations or managers can read all
DROP POLICY IF EXISTS "regularizations_select_own" ON attendance_regularizations;
CREATE POLICY "regularizations_select_own" ON attendance_regularizations
  FOR SELECT USING (
    employee_id = (SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = auth.uid()))
    OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager')
    )
  );

-- Everyone can insert their own regularizations
DROP POLICY IF EXISTS "regularizations_insert_own" ON attendance_regularizations;
CREATE POLICY "regularizations_insert_own" ON attendance_regularizations
  FOR INSERT WITH CHECK (
    employee_id = (SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = auth.uid()))
  );

-- Only HR/Managers can update regularizations (approve/reject)
DROP POLICY IF EXISTS "regularizations_update_admin" ON attendance_regularizations;
CREATE POLICY "regularizations_update_admin" ON attendance_regularizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager')
    )
  );
