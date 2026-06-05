import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireSeedAccess, authError } from '@/lib/apiAuth';


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

const leaveTypes = [
  { name: 'Vacation', description: 'Annual vacation/holiday leave', color: '#3b82f6' },
  { name: 'Sick Leave', description: 'Leave for illness', color: '#ef4444' },
  { name: 'Personal Leave', description: 'Personal emergency leave', color: '#f59e0b' },
  { name: 'Maternity Leave', description: 'Maternity leave', color: '#ec4899' },
  { name: 'Paternity Leave', description: 'Paternity leave', color: '#06b6d4' },
  { name: 'Unpaid Leave', description: 'Unpaid leave', color: '#6b7280' },
];

const leavePolicies = [
  { name: 'Vacation', days_per_year: 20 },
  { name: 'Sick Leave', days_per_year: 12 },
  { name: 'Personal Leave', days_per_year: 5 },
  { name: 'Maternity Leave', days_per_year: 120 },
  { name: 'Paternity Leave', days_per_year: 15 },
  { name: 'Unpaid Leave', days_per_year: 30 },
];

export async function POST(request: NextRequest) {
  try {
    // SECURITY: comprehensive seed — Super Admin or valid SEED_SECRET only.
    await requireSeedAccess(request);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your env.' },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    console.log('Starting comprehensive data seeding...');

    // 1. Seed employees with hierarchy
    console.log('Seeding employees...');
    for (const emp of employees) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('email', emp.email)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('employees')
          .insert({
            ...emp,
            manager: emp.manager_email,
          });
        if (error) {
          console.error(`Error inserting ${emp.email}:`, error.message);
        } else {
          console.log(`Inserted employee: ${emp.first_name} ${emp.last_name}`);
        }
      } else {
        console.log(`Employee already exists: ${emp.email}`);
      }
    }

    // 2. Seed leave types
    console.log('Seeding leave types...');
    for (const type of leaveTypes) {
      const { data: existing } = await supabase
        .from('leave_types')
        .select('id')
        .eq('name', type.name)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('leave_types')
          .insert(type);
        if (error) {
          console.error(`Error inserting leave type ${type.name}:`, error.message);
        } else {
          console.log(`Inserted leave type: ${type.name}`);
        }
      }
    }

    // 3. Seed leave policies
    console.log('Seeding leave policies...');
    for (const policy of leavePolicies) {
      const { data: leaveType } = await supabase
        .from('leave_types')
        .select('id')
        .eq('name', policy.name)
        .single();

      if (leaveType) {
        const { data: existing } = await supabase
          .from('leave_policies')
          .select('id')
          .eq('leave_type_id', leaveType.id)
          .single();

        if (!existing) {
          const { error } = await supabase
            .from('leave_policies')
            .insert({
              leave_type_id: leaveType.id,
              leave_type_name: policy.name,
              days_per_year: policy.days_per_year,
              carry_forward_allowed: true,
              max_carry_forward: 5,
            });
          if (error) {
            console.error(`Error inserting policy for ${policy.name}:`, error.message);
          } else {
            console.log(`Inserted leave policy: ${policy.name}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Data seeding complete!',
      seeded: {
        employees: employees.length,
        leaveTypes: leaveTypes.length,
        leavePolicies: leavePolicies.length,
      },
    });
  } catch (error: any) {
    const authResp = authError(error);
    if (authResp) return authResp;
    console.error('Seeding error:', error);
    return NextResponse.json(
      { error: error.message || 'Seeding failed' },
      { status: 500 }
    );
  }
}
