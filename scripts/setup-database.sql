-- ============================================================================
-- HR CORE DATABASE SETUP
-- Tables: users, employees, leave_requests, activity_feed, attendance_records
-- Role-based access control enabled
-- ============================================================================

-- 1. USERS TABLE with roles and permissions
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL,
  tier INTEGER NOT NULL,
  department TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  manager TEXT,
  join_date DATE NOT NULL,
  status TEXT NOT NULL,
  attendance_pct NUMERIC DEFAULT 0,
  salary_band TEXT,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. LEAVE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_initials TEXT NOT NULL,
  avatar_color TEXT,
  department TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  days INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ACTIVITY FEED TABLE
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon TEXT NOT NULL,
  icon_color TEXT NOT NULL,
  icon_bg TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ATTENDANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CREATE INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(location);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 8. CREATE POLICIES for different roles

-- USERS: Everyone can see their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- EMPLOYEES: Visibility based on role
-- NOTE: This RLS policy only applies to the Supabase JS client. API routes use
-- a direct postgres connection (withPgClient) that bypasses RLS, so the real
-- enforcement lives in src/lib/apiAuth.ts. This policy is the defense-in-depth
-- layer for any direct client query.
CREATE POLICY "employees_select_public" ON employees
  FOR SELECT USING (
    -- HR and Admin roles can see all employees
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid()
      AND users.role IN ('Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager')
    )
    OR
    -- Employees can see their own record
    email = (SELECT email FROM users WHERE id = auth.uid())
    OR
    -- Employees can see colleagues in their own department
    department = (SELECT department FROM users WHERE id = auth.uid())
    -- SECURITY: the previous "OR TRUE" made the whole table world-readable to
    -- any authenticated client. Removed. Do NOT re-add it.
  );

-- LEAVE REQUESTS: Role-based access
CREATE POLICY "leave_requests_select" ON leave_requests
  FOR SELECT USING (
    -- HR and Admin roles can see all leave requests
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Payroll Manager', 'Director', 'Manager', 'Team Lead')
    )
    OR
    -- Employees can see their own leave requests
    employee_id = (SELECT id FROM employees WHERE email = (SELECT email FROM users WHERE id = auth.uid()))
  );

-- LEAVE REQUESTS: Only HR and Managers can approve
CREATE POLICY "leave_requests_update" ON leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Payroll Manager', 'Director', 'Manager')
    )
  );

-- ACTIVITY FEED: Everyone can read
CREATE POLICY "activity_feed_select" ON activity_feed
  FOR SELECT USING (TRUE);

-- ATTENDANCE: HR and Managers can access
CREATE POLICY "attendance_select" ON attendance_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() 
      AND users.role IN ('Super Admin', 'Owner', 'Admin', 'HR Admin', 'HR Manager', 'HR Executive', 'Director', 'Manager')
    )
  );
