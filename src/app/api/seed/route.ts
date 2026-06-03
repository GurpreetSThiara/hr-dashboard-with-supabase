import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSeedAccess, authError } from '@/lib/apiAuth';

const EMPLOYEES_DATA = [
  { emp_id: 'EMP-0001', first_name: 'Sarah', last_name: 'Anderson', email: 'superadmin@hrcore.io', department: 'Executive', designation: 'Super Admin', employment_type: 'Full-Time', manager: null, join_date: '2018-01-10', status: 'active', attendance_pct: 99, salary_band: 'L1', location: 'New York' },
  { emp_id: 'EMP-0002', first_name: 'Marcus', last_name: 'Chen', email: 'owner@hrcore.io', department: 'Executive', designation: 'Owner', employment_type: 'Full-Time', manager: 'Sarah Anderson', join_date: '2019-03-15', status: 'active', attendance_pct: 98, salary_band: 'L2', location: 'San Francisco' },
  { emp_id: 'EMP-0003', first_name: 'Olivia', last_name: 'Park', email: 'admin@hrcore.io', department: 'IT', designation: 'Admin', employment_type: 'Full-Time', manager: 'Sarah Anderson', join_date: '2020-05-20', status: 'active', attendance_pct: 97, salary_band: 'L3', location: 'New York' },
  { emp_id: 'EMP-0004', first_name: 'Elena', last_name: 'Vasquez', email: 'hradmin@hrcore.io', department: 'HR', designation: 'HR Admin', employment_type: 'Full-Time', manager: 'Sarah Anderson', join_date: '2018-06-01', status: 'active', attendance_pct: 96, salary_band: 'L3', location: 'San Francisco' },
  { emp_id: 'EMP-0005', first_name: 'James', last_name: 'Wilson', email: 'hrmanager@hrcore.io', department: 'HR', designation: 'HR Manager', employment_type: 'Full-Time', manager: 'Elena Vasquez', join_date: '2021-02-15', status: 'active', attendance_pct: 95, salary_band: 'L4', location: 'Chicago' },
  { emp_id: 'EMP-0006', first_name: 'Priya', last_name: 'Patel', email: 'hrexec@hrcore.io', department: 'HR', designation: 'HR Executive', employment_type: 'Full-Time', manager: 'James Wilson', join_date: '2022-04-10', status: 'active', attendance_pct: 94, salary_band: 'L5', location: 'Dallas' },
  { emp_id: 'EMP-0007', first_name: 'Tom', last_name: 'Bennett', email: 'recruiter@hrcore.io', department: 'HR', designation: 'Recruiter', employment_type: 'Full-Time', manager: 'James Wilson', join_date: '2023-01-15', status: 'active', attendance_pct: 93, salary_band: 'L5', location: 'Austin' },
  { emp_id: 'EMP-0008', first_name: 'Sophie', last_name: 'Martin', email: 'payroll@hrcore.io', department: 'Finance', designation: 'Payroll Manager', employment_type: 'Full-Time', manager: 'David Kim', join_date: '2021-11-01', status: 'active', attendance_pct: 96, salary_band: 'L4', location: 'Boston' },
  { emp_id: 'EMP-0009', first_name: 'David', last_name: 'Kim', email: 'finance@hrcore.io', department: 'Finance', designation: 'Finance', employment_type: 'Full-Time', manager: 'Sarah Anderson', join_date: '2020-08-25', status: 'active', attendance_pct: 98, salary_band: 'L3', location: 'New York' },
  { emp_id: 'EMP-0010', first_name: 'Rachel', last_name: 'Green', email: 'compliance@hrcore.io', department: 'Legal', designation: 'Compliance', employment_type: 'Full-Time', manager: 'Elena Vasquez', join_date: '2022-07-01', status: 'active', attendance_pct: 95, salary_band: 'L4', location: 'New York' },
  { emp_id: 'EMP-0011', first_name: 'Alex', last_name: 'Turner', email: 'itops@hrcore.io', department: 'IT', designation: 'IT Ops', employment_type: 'Full-Time', manager: 'Olivia Park', join_date: '2023-05-15', status: 'active', attendance_pct: 92, salary_band: 'L5', location: 'Seattle' },
  { emp_id: 'EMP-0012', first_name: 'Michael', last_name: 'Brown', email: 'director@hrcore.io', department: 'Engineering', designation: 'Director', employment_type: 'Full-Time', manager: 'Marcus Chen', join_date: '2020-10-01', status: 'active', attendance_pct: 97, salary_band: 'L3', location: 'San Francisco' },
  { emp_id: 'EMP-0013', first_name: 'Lisa', last_name: 'Chen', email: 'manager@hrcore.io', department: 'Engineering', designation: 'Manager', employment_type: 'Full-Time', manager: 'Michael Brown', join_date: '2021-03-10', status: 'active', attendance_pct: 94, salary_band: 'L4', location: 'San Francisco' },
  { emp_id: 'EMP-0014', first_name: 'Ryan', last_name: 'Foster', email: 'teamlead@hrcore.io', department: 'Engineering', designation: 'Team Lead', employment_type: 'Full-Time', manager: 'Lisa Chen', join_date: '2021-12-05', status: 'active', attendance_pct: 95, salary_band: 'L5', location: 'San Francisco' },
  { emp_id: 'EMP-0015', first_name: 'Jenny', last_name: 'Liu', email: 'employee@hrcore.io', department: 'Engineering', designation: 'Employee', employment_type: 'Full-Time', manager: 'Ryan Foster', join_date: '2022-08-01', status: 'active', attendance_pct: 92, salary_band: 'L6', location: 'San Francisco' },
  { emp_id: 'EMP-0016', first_name: 'Carlos', last_name: 'Mendez', email: 'contractor@hrcore.io', department: 'Engineering', designation: 'Contractor', employment_type: 'Contractor', manager: 'Ryan Foster', join_date: '2023-04-12', status: 'active', attendance_pct: 90, salary_band: 'C3', location: 'Los Angeles' },
  { emp_id: 'EMP-0017', first_name: 'Aisha', last_name: 'Khan', email: 'intern@hrcore.io', department: 'Engineering', designation: 'Intern', employment_type: 'Intern', manager: 'Ryan Foster', join_date: '2026-02-01', status: 'active', attendance_pct: 100, salary_band: 'I1', location: 'San Francisco' },
  { emp_id: 'EMP-0018', first_name: 'Guest', last_name: 'User', email: 'readonly@hrcore.io', department: 'External', designation: 'Read-Only User', employment_type: 'Temporary', manager: 'Sarah Anderson', join_date: '2025-01-01', status: 'active', attendance_pct: 95, salary_band: 'L8', location: 'Online' }
];

export async function POST(request: NextRequest) {
  try {
    // SECURITY: destructive full reset — Super Admin or valid SEED_SECRET only.
    await requireSeedAccess(request);

    const result = await withPgClient(async (client) => {
      // 0. Clear dependent records first, then employees.
      //    (employees→children FKs are ON DELETE RESTRICT, so children must go first.)
      await client.query('DELETE FROM leave_requests');
      await client.query('DELETE FROM checkin_checkout_logs');
      await client.query('DELETE FROM attendance_regularizations');
      await client.query('DELETE FROM attendance_records');
      await client.query('DELETE FROM employees');

      // 1. Upsert employees
      const seededEmployees = [];
      for (const emp of EMPLOYEES_DATA) {
        const res = await client.query(`
          INSERT INTO employees (emp_id, first_name, last_name, email, department, designation, employment_type, manager, join_date, status, attendance_pct, salary_band, location)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id, email
        `, [
          emp.emp_id, emp.first_name, emp.last_name, emp.email, emp.department, emp.designation,
          emp.employment_type, emp.manager, emp.join_date, emp.status, emp.attendance_pct, emp.salary_band, emp.location
        ]);
        seededEmployees.push(res.rows[0]);
      }

      const empByEmail = new Map(seededEmployees.map(e => [e.email, e]));

      // 2. Seed leave requests
      const existingLeavesRes = await client.query('SELECT id FROM leave_requests LIMIT 1');
      if (existingLeavesRes.rows.length === 0) {
        const leaveData = [];

        const marcus = empByEmail.get('owner@hrcore.io');
        if (marcus) {
          leaveData.push({
            employee_id: marcus.id,
            employee_name: 'Marcus Chen',
            employee_initials: 'MC',
            avatar_color: 'bg-blue-600',
            department: 'Executive',
            leave_type: 'Annual Leave',
            days: 3,
            start_date: '2026-04-28',
            end_date: '2026-04-30',
            reason: 'Family vacation',
            status: 'pending',
          });
        }

        const aisha = empByEmail.get('intern@hrcore.io');
        if (aisha) {
          leaveData.push({
            employee_id: aisha.id,
            employee_name: 'Aisha Khan',
            employee_initials: 'AK',
            avatar_color: 'bg-violet-600',
            department: 'Engineering',
            leave_type: 'Sick Leave',
            days: 1,
            start_date: '2026-04-24',
            end_date: '2026-04-24',
            reason: 'Medical appointment',
            status: 'pending',
          });
        }

        const ryan = empByEmail.get('teamlead@hrcore.io');
        if (ryan) {
          leaveData.push({
            employee_id: ryan.id,
            employee_name: 'Ryan Foster',
            employee_initials: 'RF',
            avatar_color: 'bg-emerald-600',
            department: 'Engineering',
            leave_type: 'Annual Leave',
            days: 5,
            start_date: '2026-05-05',
            end_date: '2026-05-09',
            reason: 'Wedding',
            status: 'pending',
          });
        }

        for (const leave of leaveData) {
          await client.query(`
            INSERT INTO leave_requests (employee_id, employee_name, employee_initials, avatar_color, department, leave_type, days, start_date, end_date, reason, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            leave.employee_id, leave.employee_name, leave.employee_initials, leave.avatar_color,
            leave.department, leave.leave_type, leave.days, leave.start_date, leave.end_date, leave.reason, leave.status
          ]);
        }
      }

      // 3. Seed activity feed
      const existingActivityRes = await client.query('SELECT id FROM activity_feed LIMIT 1');
      if (existingActivityRes.rows.length === 0) {
        const activityData = [
          { icon: 'UserPlusIcon', icon_color: 'text-blue-600', icon_bg: 'bg-blue-50', description: 'Aisha Khan completed onboarding checklist' },
          { icon: 'BanknotesIcon', icon_color: 'text-emerald-600', icon_bg: 'bg-emerald-50', description: 'April payroll batch initiated by Payroll Manager' },
          { icon: 'StarIcon', icon_color: 'text-amber-500', icon_bg: 'bg-amber-50', description: 'Q1 performance reviews cycle closed — 94.2% completion' },
          { icon: 'DocumentTextIcon', icon_color: 'text-violet-600', icon_bg: 'bg-violet-50', description: 'IT Security Policy v2.4 published for acknowledgement' },
          { icon: 'BriefcaseIcon', icon_color: 'text-indigo-600', icon_bg: 'bg-indigo-50', description: 'Senior Backend Engineer offer accepted by Carlos Mendez' },
        ];

        for (const act of activityData) {
          await client.query(`
            INSERT INTO activity_feed (icon, icon_color, icon_bg, description)
            VALUES ($1, $2, $3, $4)
          `, [act.icon, act.icon_color, act.icon_bg, act.description]);
        }
      }

      // 4. Seed attendance records for today
      const today = new Date().toISOString().split('T')[0];
      for (const emp of EMPLOYEES_DATA) {
        const empRecord = empByEmail.get(emp.email);
        if (empRecord) {
          const status = emp.status === 'active' || emp.status === 'onboarding' ? 'present' : 'absent';
          const attCheck = await client.query(`
            SELECT id FROM attendance_records 
            WHERE employee_id = $1 AND attendance_date = $2 
            LIMIT 1
          `, [empRecord.id, today]);

          if (attCheck.rows.length === 0) {
            await client.query(`
              INSERT INTO attendance_records (employee_id, attendance_date, status)
              VALUES ($1, $2, $3)
            `, [empRecord.id, today, status]);
          }
        }
      }

      return seededEmployees.length;
    });

    return NextResponse.json({ success: true, message: `Database seeded successfully with ${result} employees` });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to seed database' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const data = await withPgClient(async (client) => {
      const res = await client.query('SELECT COUNT(*) as count FROM employees');
      return res.rows[0];
    });
    const count = parseInt(data.count) || 0;
    return NextResponse.json({
      seeded: count > 0,
      count: count,
      message: count > 0 ? `${count} employees have been seeded` : 'No employees found. POST to /api/seed to seed data'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
