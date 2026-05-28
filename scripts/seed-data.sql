-- ============================================================================
-- SEED DATA FOR HR CORE
-- ============================================================================

-- INSERT SAMPLE EMPLOYEES
INSERT INTO employees (emp_id, first_name, last_name, email, department, designation, employment_type, manager, join_date, status, attendance_pct, salary_band, location)
VALUES
  ('EMP-0001', 'Marcus', 'Chen', 'marcus.chen@hrcore.io', 'Engineering', 'Senior Software Engineer', 'Full-Time', 'Elena Vasquez', '2022-03-15', 'active', 97, 'L5', 'New York'),
  ('EMP-0002', 'Aisha', 'Okonkwo', 'aisha.okonkwo@hrcore.io', 'Marketing', 'Marketing Lead', 'Full-Time', 'James Kowalski', '2021-07-01', 'onleave', 88, 'L4', 'London'),
  ('EMP-0003', 'Priya', 'Sharma', 'priya.sharma@hrcore.io', 'HR', 'HR Executive', 'Full-Time', 'Sarah Mitchell', '2026-04-01', 'onboarding', 100, 'L2', 'Bangalore'),
  ('EMP-0004', 'Rohan', 'Mehta', 'rohan.mehta@hrcore.io', 'Sales', 'Account Executive', 'Full-Time', 'Derek Osei', '2020-11-22', 'active', 93, 'L3', 'Mumbai'),
  ('EMP-0005', 'Linnea', 'Bergström', 'linnea.bergstrom@hrcore.io', 'Finance', 'Financial Analyst', 'Full-Time', 'Claudia Reyes', '2019-06-10', 'active', 99, 'L4', 'Stockholm'),
  ('EMP-0006', 'Derek', 'Osei', 'derek.osei@hrcore.io', 'Operations', 'Operations Manager', 'Full-Time', 'Thomas Nakamura', '2018-02-05', 'active', 96, 'L6', 'New York'),
  ('EMP-0007', 'Nadia', 'Petrov', 'nadia.petrov@hrcore.io', 'Legal', 'Compliance Officer', 'Full-Time', 'Elena Vasquez', '2023-01-16', 'active', 94, 'L5', 'Berlin'),
  ('EMP-0008', 'Kwame', 'Asante', 'kwame.asante@hrcore.io', 'Engineering', 'DevOps Engineer', 'Contractor', 'Marcus Chen', '2025-09-01', 'active', 91, 'C3', 'Accra'),
  ('EMP-0009', 'Yuki', 'Tanaka', 'yuki.tanaka@hrcore.io', 'Design', 'UX Designer', 'Full-Time', 'Aisha Okonkwo', '2024-04-12', 'active', 98, 'L3', 'Tokyo'),
  ('EMP-0010', 'Fatima', 'Al-Rashid', 'fatima.alrashid@hrcore.io', 'Sales', 'Sales Intern', 'Intern', 'Rohan Mehta', '2026-02-15', 'onboarding', 100, 'I1', 'Dubai'),
  ('EMP-0011', 'Carlos', 'Mendoza', 'carlos.mendoza@hrcore.io', 'Engineering', 'Staff Engineer', 'Full-Time', 'Elena Vasquez', '2017-08-20', 'active', 95, 'L7', 'Mexico City'),
  ('EMP-0012', 'Sofia', 'Andersen', 'sofia.andersen@hrcore.io', 'HR', 'Recruiter', 'Full-Time', 'Sarah Mitchell', '2022-10-03', 'active', 97, 'L3', 'Copenhagen'),
  ('EMP-0013', 'James', 'Kowalski', 'james.kowalski@hrcore.io', 'Engineering', 'Backend Engineer', 'Full-Time', 'Carlos Mendoza', '2026-04-14', 'onboarding', 100, 'L4', 'Warsaw'),
  ('EMP-0014', 'Elena', 'Vasquez', 'elena.vasquez@hrcore.io', 'Engineering', 'Engineering Director', 'Full-Time', 'Thomas Nakamura', '2016-04-01', 'active', 94, 'L8', 'New York'),
  ('EMP-0015', 'Amara', 'Diallo', 'amara.diallo@hrcore.io', 'Finance', 'Senior Accountant', 'Full-Time', 'Claudia Reyes', '2020-05-18', 'terminated', 0, 'L4', 'Dakar'),
  ('EMP-0016', 'Sarah', 'Mitchell', 'sarah.mitchell@hrcore.io', 'HR', 'HR Manager', 'Full-Time', 'Thomas Nakamura', '2015-01-10', 'active', 99, 'L6', 'New York'),
  ('EMP-0017', 'Thomas', 'Nakamura', 'thomas.nakamura@hrcore.io', 'Operations', 'Chief Operations Officer', 'Full-Time', NULL, '2010-06-01', 'active', 100, 'L9', 'New York'),
  ('EMP-0018', 'Claudia', 'Reyes', 'claudia.reyes@hrcore.io', 'Finance', 'Finance Manager', 'Full-Time', 'Thomas Nakamura', '2014-03-20', 'active', 98, 'L6', 'New York');

-- INSERT LEAVE REQUESTS (with employee references)
INSERT INTO leave_requests (employee_id, employee_name, employee_initials, avatar_color, department, leave_type, days, start_date, end_date, reason, status)
SELECT 
  id,
  CONCAT(first_name, ' ', last_name),
  CONCAT(SUBSTRING(first_name, 1, 1), SUBSTRING(last_name, 1, 1)),
  'bg-blue-600',
  department,
  'Annual Leave',
  3,
  '2026-04-28'::date,
  '2026-04-30'::date,
  'Family vacation',
  'pending'
FROM employees WHERE emp_id = 'EMP-0001'

UNION ALL

SELECT 
  id,
  CONCAT(first_name, ' ', last_name),
  CONCAT(SUBSTRING(first_name, 1, 1), SUBSTRING(last_name, 1, 1)),
  'bg-violet-600',
  department,
  'Sick Leave',
  1,
  '2026-04-24'::date,
  '2026-04-24'::date,
  'Medical appointment',
  'pending'
FROM employees WHERE emp_id = 'EMP-0002'

UNION ALL

SELECT 
  id,
  CONCAT(first_name, ' ', last_name),
  CONCAT(SUBSTRING(first_name, 1, 1), SUBSTRING(last_name, 1, 1)),
  'bg-emerald-600',
  department,
  'Annual Leave',
  5,
  '2026-05-05'::date,
  '2026-05-09'::date,
  'Wedding',
  'pending'
FROM employees WHERE emp_id = 'EMP-0004'

UNION ALL

SELECT 
  id,
  CONCAT(first_name, ' ', last_name),
  CONCAT(SUBSTRING(first_name, 1, 1), SUBSTRING(last_name, 1, 1)),
  'bg-pink-600',
  department,
  'Compensatory',
  2,
  '2026-04-25'::date,
  '2026-04-26'::date,
  'Overtime compensation',
  'pending'
FROM employees WHERE emp_id = 'EMP-0005'

UNION ALL

SELECT 
  id,
  CONCAT(first_name, ' ', last_name),
  CONCAT(SUBSTRING(first_name, 1, 1), SUBSTRING(last_name, 1, 1)),
  'bg-amber-600',
  department,
  'Annual Leave',
  4,
  '2026-04-30'::date,
  '2026-05-03'::date,
  'Personal travel',
  'pending'
FROM employees WHERE emp_id = 'EMP-0006';

-- INSERT ACTIVITY FEED
INSERT INTO activity_feed (icon, icon_color, icon_bg, description)
VALUES
  ('UserPlusIcon', 'text-blue-600', 'bg-blue-50', 'Priya Sharma completed onboarding checklist'),
  ('BanknotesIcon', 'text-emerald-600', 'bg-emerald-50', 'April payroll batch initiated by Payroll Manager'),
  ('StarIcon', 'text-amber-500', 'bg-amber-50', 'Q1 performance reviews cycle closed — 94.2% completion'),
  ('DocumentTextIcon', 'text-violet-600', 'bg-violet-50', 'IT Security Policy v2.4 published for acknowledgement'),
  ('BriefcaseIcon', 'text-indigo-600', 'bg-indigo-50', 'Senior Backend Engineer offer accepted by James Kowalski'),
  ('ArrowRightOnRectangleIcon', 'text-red-500', 'bg-red-50', 'Resignation submitted by Thomas Nakamura — Engineering');

-- INSERT ATTENDANCE RECORDS FOR TODAY
INSERT INTO attendance_records (employee_id, attendance_date, status)
SELECT id, CURRENT_DATE, CASE WHEN status IN ('active', 'onboarding') THEN 'present' ELSE 'absent' END
FROM employees;
