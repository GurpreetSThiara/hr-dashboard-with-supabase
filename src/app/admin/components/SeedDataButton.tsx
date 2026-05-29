'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const SEED_EMPLOYEES = [
  { emp_id: 'EMP-001', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.johnson@hrcore.io', department: 'Executive', designation: 'Chief Executive Officer', manager_email: null, employment_type: 'Full-Time', join_date: '2019-01-15', status: 'active', salary_band: 'L1', location: 'New York', attendance_pct: 98 },
  { emp_id: 'EMP-002', first_name: 'Marcus', last_name: 'Chen', email: 'marcus.chen@hrcore.io', department: 'Engineering', designation: 'VP Engineering', manager_email: 'sarah.johnson@hrcore.io', employment_type: 'Full-Time', join_date: '2020-03-10', status: 'active', salary_band: 'L2', location: 'San Francisco', attendance_pct: 97 },
  { emp_id: 'EMP-003', first_name: 'Elena', last_name: 'Vasquez', email: 'elena.vasquez@hrcore.io', department: 'Human Resources', designation: 'VP People Operations', manager_email: 'sarah.johnson@hrcore.io', employment_type: 'Full-Time', join_date: '2020-06-01', status: 'active', salary_band: 'L2', location: 'New York', attendance_pct: 96 },
  { emp_id: 'EMP-004', first_name: 'David', last_name: 'Williams', email: 'david.williams@hrcore.io', department: 'Finance', designation: 'CFO', manager_email: 'sarah.johnson@hrcore.io', employment_type: 'Full-Time', join_date: '2019-09-20', status: 'active', salary_band: 'L2', location: 'Boston', attendance_pct: 99 },
  { emp_id: 'EMP-005', first_name: 'Priya', last_name: 'Patel', email: 'priya.patel@hrcore.io', department: 'Operations', designation: 'VP Operations', manager_email: 'sarah.johnson@hrcore.io', employment_type: 'Full-Time', join_date: '2021-01-15', status: 'active', salary_band: 'L2', location: 'New York', attendance_pct: 95 },
  { emp_id: 'EMP-006', first_name: 'Ahmed', last_name: 'Hassan', email: 'ahmed.hassan@hrcore.io', department: 'Engineering', designation: 'Senior Engineering Manager', manager_email: 'marcus.chen@hrcore.io', employment_type: 'Full-Time', join_date: '2021-02-01', status: 'active', salary_band: 'L3', location: 'San Francisco', attendance_pct: 96 },
  { emp_id: 'EMP-007', first_name: 'Lisa', last_name: 'Wong', email: 'lisa.wong@hrcore.io', department: 'Engineering', designation: 'Senior Engineering Manager', manager_email: 'marcus.chen@hrcore.io', employment_type: 'Full-Time', join_date: '2020-11-15', status: 'active', salary_band: 'L3', location: 'San Francisco', attendance_pct: 94 },
  { emp_id: 'EMP-008', first_name: 'James', last_name: 'Murphy', email: 'james.murphy@hrcore.io', department: 'Human Resources', designation: 'HR Manager', manager_email: 'elena.vasquez@hrcore.io', employment_type: 'Full-Time', join_date: '2021-03-10', status: 'active', salary_band: 'L3', location: 'New York', attendance_pct: 97 },
  { emp_id: 'EMP-009', first_name: 'Olivia', last_name: 'Brown', email: 'olivia.brown@hrcore.io', department: 'Finance', designation: 'Finance Manager', manager_email: 'david.williams@hrcore.io', employment_type: 'Full-Time', join_date: '2021-05-01', status: 'active', salary_band: 'L3', location: 'Boston', attendance_pct: 98 },
  { emp_id: 'EMP-010', first_name: 'Robert', last_name: 'Taylor', email: 'robert.taylor@hrcore.io', department: 'Engineering', designation: 'Tech Lead', manager_email: 'ahmed.hassan@hrcore.io', employment_type: 'Full-Time', join_date: '2021-07-15', status: 'active', salary_band: 'L4', location: 'San Francisco', attendance_pct: 95 },
  { emp_id: 'EMP-011', first_name: 'Sophie', last_name: 'Martin', email: 'sophie.martin@hrcore.io', department: 'Engineering', designation: 'Tech Lead', manager_email: 'lisa.wong@hrcore.io', employment_type: 'Full-Time', join_date: '2021-06-01', status: 'active', salary_band: 'L4', location: 'San Francisco', attendance_pct: 93 },
  { emp_id: 'EMP-012', first_name: 'John', last_name: 'Smith', email: 'john.smith@hrcore.io', department: 'Engineering', designation: 'Senior Software Engineer', manager_email: 'robert.taylor@hrcore.io', employment_type: 'Full-Time', join_date: '2021-08-10', status: 'active', salary_band: 'L5', location: 'San Francisco', attendance_pct: 92 },
  { emp_id: 'EMP-013', first_name: 'Maria', last_name: 'Garcia', email: 'maria.garcia@hrcore.io', department: 'Engineering', designation: 'Software Engineer', manager_email: 'robert.taylor@hrcore.io', employment_type: 'Full-Time', join_date: '2022-01-15', status: 'active', salary_band: 'L6', location: 'San Francisco', attendance_pct: 91 },
  { emp_id: 'EMP-014', first_name: 'Emma', last_name: 'Wilson', email: 'emma.wilson@hrcore.io', department: 'Engineering', designation: 'Software Engineer', manager_email: 'sophie.martin@hrcore.io', employment_type: 'Full-Time', join_date: '2022-02-20', status: 'active', salary_band: 'L6', location: 'San Francisco', attendance_pct: 89 },
  { emp_id: 'EMP-015', first_name: 'Michael', last_name: 'Johnson', email: 'michael.johnson@hrcore.io', department: 'Human Resources', designation: 'HR Executive', manager_email: 'james.murphy@hrcore.io', employment_type: 'Full-Time', join_date: '2022-03-10', status: 'active', salary_band: 'L5', location: 'New York', attendance_pct: 94 },
  { emp_id: 'EMP-016', first_name: 'Jennifer', last_name: 'Lee', email: 'jennifer.lee@hrcore.io', department: 'Finance', designation: 'Accountant', manager_email: 'olivia.brown@hrcore.io', employment_type: 'Full-Time', join_date: '2022-04-15', status: 'active', salary_band: 'L6', location: 'Boston', attendance_pct: 90 },
  { emp_id: 'EMP-017', first_name: 'Christopher', last_name: 'Davis', email: 'christopher.davis@hrcore.io', department: 'Operations', designation: 'Operations Analyst', manager_email: 'priya.patel@hrcore.io', employment_type: 'Full-Time', join_date: '2022-05-01', status: 'active', salary_band: 'L6', location: 'New York', attendance_pct: 88 },
  { emp_id: 'EMP-018', first_name: 'Rachel', last_name: 'Green', email: 'rachel.green@hrcore.io', department: 'Engineering', designation: 'Junior Engineer', manager_email: 'robert.taylor@hrcore.io', employment_type: 'Full-Time', join_date: '2023-06-01', status: 'active', salary_band: 'L7', location: 'San Francisco', attendance_pct: 85 },
];

export default function SeedDataButton() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSeedEmployees = async () => {
    setLoading(true);
    try {
      // Check if employees already exist
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .limit(1);

      if (existing && existing.length > 0) {
        toast.info('Employees are already seeded in the database.');
        setLoading(false);
        return;
      }

      // Insert employees
      let seededCount = 0;
      for (const emp of SEED_EMPLOYEES) {
        const { error } = await supabase
          .from('employees')
          .insert({
            ...emp,
            manager: emp.manager_email,
          });

        if (!error) {
          seededCount++;
        }
      }

      toast.success(`Successfully added ${seededCount} employees to the database.`);

      // Reload page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      toast.error(`Seed failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSeedEmployees}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Icon name="CheckIcon" size={18} />
      {loading ? 'Seeding...' : 'Seed 18 Demo Employees'}
    </button>
  );
}
