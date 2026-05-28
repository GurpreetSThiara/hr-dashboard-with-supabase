import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const EMPLOYEES_DATA = [
  { emp_id: 'EMP-0001', first_name: 'Marcus', last_name: 'Chen', email: 'marcus.chen@hrcore.io', department: 'Engineering', designation: 'Senior Software Engineer', employment_type: 'Full-Time', manager: 'Elena Vasquez', join_date: '2022-03-15', status: 'active', attendance_pct: 97, salary_band: 'L5', location: 'New York' },
  { emp_id: 'EMP-0002', first_name: 'Aisha', last_name: 'Okonkwo', email: 'aisha.okonkwo@hrcore.io', department: 'Marketing', designation: 'Marketing Lead', employment_type: 'Full-Time', manager: 'James Kowalski', join_date: '2021-07-01', status: 'onleave', attendance_pct: 88, salary_band: 'L4', location: 'London' },
  { emp_id: 'EMP-0003', first_name: 'Priya', last_name: 'Sharma', email: 'priya.sharma@hrcore.io', department: 'HR', designation: 'HR Executive', employment_type: 'Full-Time', manager: 'Sarah Mitchell', join_date: '2026-04-01', status: 'onboarding', attendance_pct: 100, salary_band: 'L2', location: 'Bangalore' },
  { emp_id: 'EMP-0004', first_name: 'Rohan', last_name: 'Mehta', email: 'rohan.mehta@hrcore.io', department: 'Sales', designation: 'Account Executive', employment_type: 'Full-Time', manager: 'Derek Osei', join_date: '2020-11-22', status: 'active', attendance_pct: 93, salary_band: 'L3', location: 'Mumbai' },
  { emp_id: 'EMP-0005', first_name: 'Linnea', last_name: 'Bergström', email: 'linnea.bergstrom@hrcore.io', department: 'Finance', designation: 'Financial Analyst', employment_type: 'Full-Time', manager: 'Claudia Reyes', join_date: '2019-06-10', status: 'active', attendance_pct: 99, salary_band: 'L4', location: 'Stockholm' },
  { emp_id: 'EMP-0006', first_name: 'Derek', last_name: 'Osei', email: 'derek.osei@hrcore.io', department: 'Operations', designation: 'Operations Manager', employment_type: 'Full-Time', manager: 'Thomas Nakamura', join_date: '2018-02-05', status: 'active', attendance_pct: 96, salary_band: 'L6', location: 'New York' },
  { emp_id: 'EMP-0007', first_name: 'Nadia', last_name: 'Petrov', email: 'nadia.petrov@hrcore.io', department: 'Legal', designation: 'Compliance Officer', employment_type: 'Full-Time', manager: 'Elena Vasquez', join_date: '2023-01-16', status: 'active', attendance_pct: 94, salary_band: 'L5', location: 'Berlin' },
  { emp_id: 'EMP-0008', first_name: 'Kwame', last_name: 'Asante', email: 'kwame.asante@hrcore.io', department: 'Engineering', designation: 'DevOps Engineer', employment_type: 'Contractor', manager: 'Marcus Chen', join_date: '2025-09-01', status: 'active', attendance_pct: 91, salary_band: 'C3', location: 'Accra' },
  { emp_id: 'EMP-0009', first_name: 'Yuki', last_name: 'Tanaka', email: 'yuki.tanaka@hrcore.io', department: 'Design', designation: 'UX Designer', employment_type: 'Full-Time', manager: 'Aisha Okonkwo', join_date: '2024-04-12', status: 'active', attendance_pct: 98, salary_band: 'L3', location: 'Tokyo' },
  { emp_id: 'EMP-0010', first_name: 'Fatima', last_name: 'Al-Rashid', email: 'fatima.alrashid@hrcore.io', department: 'Sales', designation: 'Sales Intern', employment_type: 'Intern', manager: 'Rohan Mehta', join_date: '2026-02-15', status: 'onboarding', attendance_pct: 100, salary_band: 'I1', location: 'Dubai' },
  { emp_id: 'EMP-0011', first_name: 'Carlos', last_name: 'Mendoza', email: 'carlos.mendoza@hrcore.io', department: 'Engineering', designation: 'Staff Engineer', employment_type: 'Full-Time', manager: 'Elena Vasquez', join_date: '2017-08-20', status: 'active', attendance_pct: 95, salary_band: 'L7', location: 'Mexico City' },
  { emp_id: 'EMP-0012', first_name: 'Sofia', last_name: 'Andersen', email: 'sofia.andersen@hrcore.io', department: 'HR', designation: 'Recruiter', employment_type: 'Full-Time', manager: 'Sarah Mitchell', join_date: '2022-10-03', status: 'active', attendance_pct: 97, salary_band: 'L3', location: 'Copenhagen' },
  { emp_id: 'EMP-0013', first_name: 'James', last_name: 'Kowalski', email: 'james.kowalski@hrcore.io', department: 'Engineering', designation: 'Backend Engineer', employment_type: 'Full-Time', manager: 'Carlos Mendoza', join_date: '2026-04-14', status: 'onboarding', attendance_pct: 100, salary_band: 'L4', location: 'Warsaw' },
  { emp_id: 'EMP-0014', first_name: 'Elena', last_name: 'Vasquez', email: 'elena.vasquez@hrcore.io', department: 'Engineering', designation: 'Engineering Director', employment_type: 'Full-Time', manager: 'Thomas Nakamura', join_date: '2016-04-01', status: 'active', attendance_pct: 94, salary_band: 'L8', location: 'New York' },
  { emp_id: 'EMP-0015', first_name: 'Amara', last_name: 'Diallo', email: 'amara.diallo@hrcore.io', department: 'Finance', designation: 'Senior Accountant', employment_type: 'Full-Time', manager: 'Claudia Reyes', join_date: '2020-05-18', status: 'terminated', attendance_pct: 0, salary_band: 'L4', location: 'Dakar' },
  { emp_id: 'EMP-0016', first_name: 'Sarah', last_name: 'Mitchell', email: 'sarah.mitchell@hrcore.io', department: 'HR', designation: 'HR Manager', employment_type: 'Full-Time', manager: 'Thomas Nakamura', join_date: '2015-01-10', status: 'active', attendance_pct: 99, salary_band: 'L6', location: 'New York' },
  { emp_id: 'EMP-0017', first_name: 'Thomas', last_name: 'Nakamura', email: 'thomas.nakamura@hrcore.io', department: 'Operations', designation: 'Chief Operations Officer', employment_type: 'Full-Time', manager: null, join_date: '2010-06-01', status: 'active', attendance_pct: 100, salary_band: 'L9', location: 'New York' },
  { emp_id: 'EMP-0018', first_name: 'Claudia', last_name: 'Reyes', email: 'claudia.reyes@hrcore.io', department: 'Finance', designation: 'Finance Manager', employment_type: 'Full-Time', manager: 'Thomas Nakamura', join_date: '2014-03-20', status: 'active', attendance_pct: 98, salary_band: 'L6', location: 'New York' },
];

export async function POST() {
  try {
    // Seed employees
    const { error: empError } = await supabase
      .from('employees')
      .insert(EMPLOYEES_DATA);

    if (empError && !empError.message.includes('duplicate')) {
      throw empError;
    }

    // Seed leave requests (fetch employees first to get IDs)
    const { data: employees } = await supabase.from('employees').select('*');

    if (employees && employees.length > 0) {
      const leaveData = [
        {
          employee_id: employees[0]?.id,
          employee_name: 'Marcus Chen',
          employee_initials: 'MC',
          avatar_color: 'bg-blue-600',
          department: 'Engineering',
          leave_type: 'Annual Leave',
          days: 3,
          start_date: '2026-04-28',
          end_date: '2026-04-30',
          reason: 'Family vacation',
          status: 'pending',
        },
        {
          employee_id: employees[1]?.id,
          employee_name: 'Aisha Okonkwo',
          employee_initials: 'AO',
          avatar_color: 'bg-violet-600',
          department: 'Marketing',
          leave_type: 'Sick Leave',
          days: 1,
          start_date: '2026-04-24',
          end_date: '2026-04-24',
          reason: 'Medical appointment',
          status: 'pending',
        },
        {
          employee_id: employees[3]?.id,
          employee_name: 'Rohan Mehta',
          employee_initials: 'RM',
          avatar_color: 'bg-emerald-600',
          department: 'Sales',
          leave_type: 'Annual Leave',
          days: 5,
          start_date: '2026-05-05',
          end_date: '2026-05-09',
          reason: 'Wedding',
          status: 'pending',
        },
      ];

      const { error: leaveError } = await supabase
        .from('leave_requests')
        .insert(leaveData);

      if (leaveError && !leaveError.message.includes('duplicate')) {
        throw leaveError;
      }
    }

    // Seed activity feed
    const activityData = [
      { icon: 'UserPlusIcon', icon_color: 'text-blue-600', icon_bg: 'bg-blue-50', description: 'Priya Sharma completed onboarding checklist' },
      { icon: 'BanknotesIcon', icon_color: 'text-emerald-600', icon_bg: 'bg-emerald-50', description: 'April payroll batch initiated by Payroll Manager' },
      { icon: 'StarIcon', icon_color: 'text-amber-500', icon_bg: 'bg-amber-50', description: 'Q1 performance reviews cycle closed — 94.2% completion' },
      { icon: 'DocumentTextIcon', icon_color: 'text-violet-600', icon_bg: 'bg-violet-50', description: 'IT Security Policy v2.4 published for acknowledgement' },
      { icon: 'BriefcaseIcon', icon_color: 'text-indigo-600', icon_bg: 'bg-indigo-50', description: 'Senior Backend Engineer offer accepted by James Kowalski' },
    ];

    const { error: activityError } = await supabase
      .from('activity_feed')
      .insert(activityData);

    if (activityError && !activityError.message.includes('duplicate')) {
      throw activityError;
    }

    // Seed attendance records for today
    if (employees && employees.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const attendanceData = employees.map((emp: any) => ({
        employee_id: emp.id,
        attendance_date: today,
        status: emp.status === 'active' || emp.status === 'onboarding' ? 'present' : 'absent',
      }));

      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .insert(attendanceData);

      if (attendanceError && !attendanceError.message.includes('duplicate')) {
        throw attendanceError;
      }
    }

    return NextResponse.json({ success: true, message: 'Database seeded successfully' });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to seed database' },
      { status: 500 }
    );
  }
}
