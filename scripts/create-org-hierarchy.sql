-- Add reporting manager column to employees table if not exists
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reporting_manager_email VARCHAR;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_reporting_manager ON employees(reporting_manager_email);

-- Create organizational hierarchy view
CREATE OR REPLACE VIEW org_hierarchy AS
SELECT 
  e.id,
  e.emp_id,
  e.first_name,
  e.last_name,
  e.email,
  e.department,
  e.designation,
  m.id as manager_id,
  m.emp_id as manager_emp_id,
  m.first_name as manager_first_name,
  m.last_name as manager_last_name,
  m.email as manager_email,
  m.designation as manager_designation
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;

-- Create department hierarchy view
CREATE OR REPLACE VIEW department_structure AS
SELECT 
  department,
  designation,
  COUNT(*) as count,
  COUNT(DISTINCT manager_id) as manager_count
FROM employees
WHERE status = 'active'
GROUP BY department, designation
ORDER BY department, designation;
