import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

const employees = [
  // CEO
  { emp_id: 'EMP-001', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.johnson@hrcore.io', department: 'Executive', designation: 'Chief Executive Officer', manager_email: null, employment_type: 'Full-Time', join_date: '2019-01-15', status: 'active', salary_band: 'L1', location: 'New York', attendance_pct: 98 },
  // Directors
  { emp_id: 'EMP-002', first_name: 'Marcus', last_name: 'Chen', email: 'marcus.chen@hrcore.io', department: 'Engineering', designation: 'VP Engineering', manager_email: 'sarah.johnson@hrcore.io', employment_type: 'Full-Time', join_date: '2020-03-10', status: 'active', salary_band: 'L2', location: 'San Francisco', attendance_pct: 97 },
  { emp_id: 'EMP-003', first_name: 'Elena', last_name: 'Vasquez', email: 'elena.vasquez@hrcore.io', department: 'Human Resources', designation: 'VP People Operations', manager_email: 'sarah.johnson@hrcore.io', employment_type: 'Full-Time', join_date: '2020-06-01', status: 'active', salary_band: 'L2', location: 'New York', attendance_pct: 96 },
  { emp_id: 'EMP-004', first_name: 'David', last_name: 'Williams', email: 'david.williams@hrcore.io', department: 'Finance', designation: 'CFO', manager_email: 'sarah.johnson@hrcore.io', employment_type: 'Full-Time', join_date: '2019-09-20', status: 'active', salary_band: 'L2', location: 'Boston', attendance_pct: 99 },
  { emp_id: 'EMP-005', first_name: 'Priya', last_name: 'Patel', email: 'priya.patel@hrcore.io', department: 'Operations', designation: 'VP Operations', manager_email: 'sarah.johnson@hrcore.io', employment_type: 'Full-Time', join_date: '2021-01-15', status: 'active', salary_band: 'L2', location: 'New York', attendance_pct: 95 },
  // Senior Managers
  { emp_id: 'EMP-006', first_name: 'Ahmed', last_name: 'Hassan', email: 'ahmed.hassan@hrcore.io', department: 'Engineering', designation: 'Senior Engineering Manager', manager_email: 'marcus.chen@hrcore.io', employment_type: 'Full-Time', join_date: '2021-02-01', status: 'active', salary_band: 'L3', location: 'San Francisco', attendance_pct: 96 },
  { emp_id: 'EMP-007', first_name: 'Lisa', last_name: 'Wong', email: 'lisa.wong@hrcore.io', department: 'Engineering', designation: 'Senior Engineering Manager', manager_email: 'marcus.chen@hrcore.io', employment_type: 'Full-Time', join_date: '2020-11-15', status: 'active', salary_band: 'L3', location: 'San Francisco', attendance_pct: 94 },
  { emp_id: 'EMP-008', first_name: 'James', last_name: 'Murphy', email: 'james.murphy@hrcore.io', department: 'Human Resources', designation: 'HR Manager', manager_email: 'elena.vasquez@hrcore.io', employment_type: 'Full-Time', join_date: '2021-03-10', status: 'active', salary_band: 'L3', location: 'New York', attendance_pct: 97 },
  { emp_id: 'EMP-009', first_name: 'Olivia', last_name: 'Brown', email: 'olivia.brown@hrcore.io', department: 'Finance', designation: 'Finance Manager', manager_email: 'david.williams@hrcore.io', employment_type: 'Full-Time', join_date: '2021-05-01', status: 'active', salary_band: 'L3', location: 'Boston', attendance_pct: 98 },
  // Team Leads
  { emp_id: 'EMP-010', first_name: 'Robert', last_name: 'Taylor', email: 'robert.taylor@hrcore.io', department: 'Engineering', designation: 'Tech Lead', manager_email: 'ahmed.hassan@hrcore.io', employment_type: 'Full-Time', join_date: '2021-07-15', status: 'active', salary_band: 'L4', location: 'San Francisco', attendance_pct: 95 },
  { emp_id: 'EMP-011', first_name: 'Sophie', last_name: 'Martin', email: 'sophie.martin@hrcore.io', department: 'Engineering', designation: 'Tech Lead', manager_email: 'lisa.wong@hrcore.io', employment_type: 'Full-Time', join_date: '2021-06-01', status: 'active', salary_band: 'L4', location: 'San Francisco', attendance_pct: 93 },
  // Individual Contributors
  { emp_id: 'EMP-012', first_name: 'John', last_name: 'Smith', email: 'john.smith@hrcore.io', department: 'Engineering', designation: 'Senior Software Engineer', manager_email: 'robert.taylor@hrcore.io', employment_type: 'Full-Time', join_date: '2021-08-10', status: 'active', salary_band: 'L5', location: 'San Francisco', attendance_pct: 92 },
  { emp_id: 'EMP-013', first_name: 'Maria', last_name: 'Garcia', email: 'maria.garcia@hrcore.io', department: 'Engineering', designation: 'Software Engineer', manager_email: 'robert.taylor@hrcore.io', employment_type: 'Full-Time', join_date: '2022-01-15', status: 'active', salary_band: 'L6', location: 'San Francisco', attendance_pct: 91 },
  { emp_id: 'EMP-014', first_name: 'Emma', last_name: 'Wilson', email: 'emma.wilson@hrcore.io', department: 'Engineering', designation: 'Software Engineer', manager_email: 'sophie.martin@hrcore.io', employment_type: 'Full-Time', join_date: '2022-02-20', status: 'active', salary_band: 'L6', location: 'San Francisco', attendance_pct: 89 },
  { emp_id: 'EMP-015', first_name: 'Michael', last_name: 'Johnson', email: 'michael.johnson@hrcore.io', department: 'Human Resources', designation: 'HR Executive', manager_email: 'james.murphy@hrcore.io', employment_type: 'Full-Time', join_date: '2022-03-10', status: 'active', salary_band: 'L5', location: 'New York', attendance_pct: 94 },
  { emp_id: 'EMP-016', first_name: 'Jennifer', last_name: 'Lee', email: 'jennifer.lee@hrcore.io', department: 'Finance', designation: 'Accountant', manager_email: 'olivia.brown@hrcore.io', employment_type: 'Full-Time', join_date: '2022-04-15', status: 'active', salary_band: 'L6', location: 'Boston', attendance_pct: 90 },
  { emp_id: 'EMP-017', first_name: 'Christopher', last_name: 'Davis', email: 'christopher.davis@hrcore.io', department: 'Operations', designation: 'Operations Analyst', manager_email: 'priya.patel@hrcore.io', employment_type: 'Full-Time', join_date: '2022-05-01', status: 'active', salary_band: 'L6', location: 'New York', attendance_pct: 88 },
  { emp_id: 'EMP-018', first_name: 'Rachel', last_name: 'Green', email: 'rachel.green@hrcore.io', department: 'Engineering', designation: 'Junior Engineer', manager_email: 'robert.taylor@hrcore.io', employment_type: 'Full-Time', join_date: '2023-06-01', status: 'active', salary_band: 'L7', location: 'San Francisco', attendance_pct: 85 },
];

export async function POST(request: NextRequest) {
  try {
    // Check auth (optional)
    const authHeader = request.headers.get('authorization');
    if (authHeader && !authHeader.includes('Bearer') && authHeader !== 'admin-key') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if employees already exist
    const { data: existingEmployees } = await supabase
      .from('employees')
      .select('id')
      .limit(1);

    if (existingEmployees && existingEmployees.length > 0) {
      const { data: countResult } = await supabase
        .from('employees')
        .select('id', { count: 'exact' });
      return NextResponse.json(
        { 
          message: 'Employees already seeded',
          count: countResult?.length || 0
        },
        { status: 200 }
      );
    }

    // Insert employees
    let seededCount = 0;
    let errorCount = 0;

    for (const emp of employees) {
      const { error } = await supabase
        .from('employees')
        .insert({
          ...emp,
          manager: emp.manager_email,
        });

      if (error) {
        console.error(`Error inserting ${emp.email}:`, error.message);
        errorCount++;
      } else {
        seededCount++;
        console.log(`Inserted employee: ${emp.first_name} ${emp.last_name}`);
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: `Successfully seeded ${seededCount} employees`,
        seeded: seededCount,
        errors: errorCount
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Fatal seed error:', error);
    return NextResponse.json(
      { error: 'Seed failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check seed status
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact' });

    if (error) {
      return NextResponse.json(
        { seeded: false, count: 0, error: error.message },
        { status: 500 }
      );
    }

    const count = data?.length || 0;
    return NextResponse.json(
      { 
        seeded: count > 0,
        count: count,
        message: count > 0 
          ? `${count} employees have been seeded` 
          : 'No employees found. POST to /api/seed/employees to seed data'
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, count: 0 },
      { status: 500 }
    );
  }
}
