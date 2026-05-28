-- Create leave types table
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR DEFAULT '#3b82f6',
  requires_document BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create leave policies table
CREATE TABLE IF NOT EXISTS leave_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE NOT NULL,
  leave_type_name VARCHAR NOT NULL,
  days_per_year INTEGER NOT NULL,
  carry_forward_allowed BOOLEAN DEFAULT true,
  max_carry_forward INTEGER DEFAULT 5,
  gender_specific VARCHAR, -- 'male', 'female', or null for all
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(leave_type_id)
);

-- Create attendance records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  status VARCHAR DEFAULT 'present', -- present, absent, half-day, wfh
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- Create check-in/check-out logs
CREATE TABLE IF NOT EXISTS checkin_checkout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  duration_minutes INTEGER,
  location VARCHAR,
  device VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Update leave_requests table to add necessary fields
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type VARCHAR;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approver_id UUID;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approver_notes TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS days_count INTEGER DEFAULT 1;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_carry_forward BOOLEAN DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leave_types_name ON leave_types(name);
CREATE INDEX IF NOT EXISTS idx_leave_policies_type ON leave_policies(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_checkin_employee_date ON checkin_checkout_logs(employee_id, DATE(check_in_time));
CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON leave_requests(leave_type);

-- Create views for leave analytics
CREATE OR REPLACE VIEW leave_balance_view AS
SELECT 
  e.id,
  e.emp_id,
  e.first_name,
  e.last_name,
  lt.name as leave_type,
  lp.days_per_year,
  COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_count ELSE 0 END), 0) as days_used,
  lp.days_per_year - COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days_count ELSE 0 END), 0) as days_remaining
FROM employees e
CROSS JOIN leave_types lt
LEFT JOIN leave_policies lp ON lt.id = lp.leave_type_id
LEFT JOIN leave_requests lr ON e.id = lr.employee_id AND lt.name = lr.leave_type AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE e.status = 'active'
GROUP BY e.id, e.emp_id, e.first_name, e.last_name, lt.name, lt.id, lp.days_per_year;
