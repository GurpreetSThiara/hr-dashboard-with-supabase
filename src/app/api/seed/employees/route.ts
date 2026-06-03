import { NextRequest, NextResponse } from 'next/server';
import { withPgClient } from '@/lib/pgClient';
import { requireSeedAccess, authError } from '@/lib/apiAuth';

const employees = [
  { emp_id: 'EMP-0001', first_name: 'Sarah', last_name: 'Anderson', email: 'superadmin@hrcore.io', department: 'Executive', designation: 'Super Admin', manager_email: null, employment_type: 'Full-Time', join_date: '2018-01-10', status: 'active', salary_band: 'L1', location: 'New York', attendance_pct: 99 },
  { emp_id: 'EMP-0002', first_name: 'Marcus', last_name: 'Chen', email: 'owner@hrcore.io', department: 'Executive', designation: 'Owner', manager_email: 'superadmin@hrcore.io', employment_type: 'Full-Time', join_date: '2019-03-15', status: 'active', salary_band: 'L2', location: 'San Francisco', attendance_pct: 98 },
  { emp_id: 'EMP-0003', first_name: 'Olivia', last_name: 'Park', email: 'admin@hrcore.io', department: 'IT', designation: 'Admin', manager_email: 'superadmin@hrcore.io', employment_type: 'Full-Time', join_date: '2020-05-20', status: 'active', salary_band: 'L3', location: 'New York', attendance_pct: 97 },
  { emp_id: 'EMP-0004', first_name: 'Elena', last_name: 'Vasquez', email: 'hradmin@hrcore.io', department: 'HR', designation: 'HR Admin', manager_email: 'superadmin@hrcore.io', employment_type: 'Full-Time', join_date: '2018-06-01', status: 'active', salary_band: 'L3', location: 'San Francisco', attendance_pct: 96 },
  { emp_id: 'EMP-0005', first_name: 'James', last_name: 'Wilson', email: 'hrmanager@hrcore.io', department: 'HR', designation: 'HR Manager', manager_email: 'hradmin@hrcore.io', employment_type: 'Full-Time', join_date: '2021-02-15', status: 'active', salary_band: 'L4', location: 'Chicago', attendance_pct: 95 },
  { emp_id: 'EMP-0006', first_name: 'Priya', last_name: 'Patel', email: 'hrexec@hrcore.io', department: 'HR', designation: 'HR Executive', manager_email: 'hrmanager@hrcore.io', employment_type: 'Full-Time', join_date: '2022-04-10', status: 'active', salary_band: 'L5', location: 'Dallas', attendance_pct: 94 },
  { emp_id: 'EMP-0007', first_name: 'Tom', last_name: 'Bennett', email: 'recruiter@hrcore.io', department: 'HR', designation: 'Recruiter', manager_email: 'hrmanager@hrcore.io', employment_type: 'Full-Time', join_date: '2023-01-15', status: 'active', salary_band: 'L5', location: 'Austin', attendance_pct: 93 },
  { emp_id: 'EMP-0008', first_name: 'Sophie', last_name: 'Martin', email: 'payroll@hrcore.io', department: 'Finance', designation: 'Payroll Manager', manager_email: 'finance@hrcore.io', employment_type: 'Full-Time', join_date: '2021-11-01', status: 'active', salary_band: 'L4', location: 'Boston', attendance_pct: 96 },
  { emp_id: 'EMP-0009', first_name: 'David', last_name: 'Kim', email: 'finance@hrcore.io', department: 'Finance', designation: 'Finance', manager_email: 'superadmin@hrcore.io', employment_type: 'Full-Time', join_date: '2020-08-25', status: 'active', salary_band: 'L3', location: 'New York', attendance_pct: 98 },
  { emp_id: 'EMP-0010', first_name: 'Rachel', last_name: 'Green', email: 'compliance@hrcore.io', department: 'Legal', designation: 'Compliance', manager_email: 'hradmin@hrcore.io', employment_type: 'Full-Time', join_date: '2022-07-01', status: 'active', salary_band: 'L4', location: 'New York', attendance_pct: 95 },
  { emp_id: 'EMP-0011', first_name: 'Alex', last_name: 'Turner', email: 'itops@hrcore.io', department: 'IT', designation: 'IT Ops', manager_email: 'admin@hrcore.io', employment_type: 'Full-Time', join_date: '2023-05-15', status: 'active', salary_band: 'L5', location: 'Seattle', attendance_pct: 92 },
  { emp_id: 'EMP-0012', first_name: 'Michael', last_name: 'Brown', email: 'director@hrcore.io', department: 'Engineering', designation: 'Director', manager_email: 'owner@hrcore.io', employment_type: 'Full-Time', join_date: '2020-10-01', status: 'active', salary_band: 'L3', location: 'San Francisco', attendance_pct: 97 },
  { emp_id: 'EMP-0013', first_name: 'Lisa', last_name: 'Chen', email: 'manager@hrcore.io', department: 'Engineering', designation: 'Manager', manager_email: 'director@hrcore.io', employment_type: 'Full-Time', join_date: '2021-03-10', status: 'active', salary_band: 'L4', location: 'San Francisco', attendance_pct: 94 },
  { emp_id: 'EMP-0014', first_name: 'Ryan', last_name: 'Foster', email: 'teamlead@hrcore.io', department: 'Engineering', designation: 'Team Lead', manager_email: 'manager@hrcore.io', employment_type: 'Full-Time', join_date: '2021-12-05', status: 'active', salary_band: 'L5', location: 'San Francisco', attendance_pct: 95 },
  { emp_id: 'EMP-0015', first_name: 'Jenny', last_name: 'Liu', email: 'employee@hrcore.io', department: 'Engineering', designation: 'Employee', manager_email: 'teamlead@hrcore.io', employment_type: 'Full-Time', join_date: '2022-08-01', status: 'active', salary_band: 'L6', location: 'San Francisco', attendance_pct: 92 },
  { emp_id: 'EMP-0016', first_name: 'Carlos', last_name: 'Mendez', email: 'contractor@hrcore.io', department: 'Engineering', designation: 'Contractor', manager_email: 'teamlead@hrcore.io', employment_type: 'Contractor', join_date: '2023-04-12', status: 'active', salary_band: 'C3', location: 'Los Angeles', attendance_pct: 90 },
  { emp_id: 'EMP-0017', first_name: 'Aisha', last_name: 'Khan', email: 'intern@hrcore.io', department: 'Engineering', designation: 'Intern', manager_email: 'teamlead@hrcore.io', employment_type: 'Intern', join_date: '2026-02-01', status: 'active', salary_band: 'I1', location: 'San Francisco', attendance_pct: 100 },
  { emp_id: 'EMP-0018', first_name: 'Guest', last_name: 'User', email: 'readonly@hrcore.io', department: 'External', designation: 'Read-Only User', manager_email: 'superadmin@hrcore.io', employment_type: 'Temporary', join_date: '2025-01-01', status: 'active', salary_band: 'L8', location: 'Online', attendance_pct: 95 }
];

export async function POST(request: NextRequest) {
  try {
    // SECURITY: destructive reset — Super Admin or valid SEED_SECRET only.
    await requireSeedAccess(request);

    const result = await withPgClient(async (client) => {
      // 0. Clear dependent records first (FKs are ON DELETE RESTRICT), then employees.
      await client.query('DELETE FROM leave_requests');
      await client.query('DELETE FROM checkin_checkout_logs');
      await client.query('DELETE FROM attendance_regularizations');
      await client.query('DELETE FROM attendance_records');
      await client.query('DELETE FROM employees');

      let seededCount = 0;
      for (const emp of employees) {
        await client.query(`
          INSERT INTO employees (emp_id, first_name, last_name, email, department, designation, manager, employment_type, join_date, status, salary_band, location, attendance_pct)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          emp.emp_id, emp.first_name, emp.last_name, emp.email, emp.department, emp.designation,
          emp.manager_email, emp.employment_type, emp.join_date, emp.status, emp.salary_band, emp.location, emp.attendance_pct
        ]);
        seededCount++;
      }
      return seededCount;
    });

    return NextResponse.json(
      { 
        success: true, 
        message: `Successfully seeded ${result} employees`,
        seeded: result,
        errors: 0
      },
      { status: 200 }
    );
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    console.error('Fatal seed error:', error);
    return NextResponse.json(
      { error: 'Seed failed', details: error.message },
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
      message: count > 0 
        ? `${count} employees have been seeded` 
        : 'No employees found. POST to /api/seed/employees to seed data'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, count: 0 },
      { status: 500 }
    );
  }
}
