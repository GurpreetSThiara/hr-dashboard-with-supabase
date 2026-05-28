import useSWR from 'swr';
import { createClient } from './supabase/client';

const supabase = createClient();

// Fetcher function for SWR
export const fetcher = async (key: string) => {
  if (!key) return null;
  
  const [table, ...params] = key.split(':');
  
  let query = supabase.from(table).select('*');
  
  // Parse and apply filters
  if (params.length > 0) {
    const filter = params[0];
    const [field, value] = filter.split('=');
    query = query.eq(field, value);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data;
};

// Fetch all employees
export function useEmployees() {
  return useSWR('employees', fetcher);
}

// Fetch employees by department
export function useEmployeesByDepartment(department: string) {
  return useSWR(department ? `employees:department=${department}` : null, fetcher);
}

// Fetch all leave requests
export function useLeaveRequests() {
  return useSWR('leave_requests', fetcher);
}

// Fetch pending leave requests
export function usePendingLeaveRequests() {
  const { data, error, isLoading } = useSWR('leave_requests', async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  });

  return { data, error, isLoading };
}

// Fetch activity feed
export function useActivityFeed() {
  return useSWR('activity_feed', async () => {
    const { data, error } = await supabase
      .from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  });
}

// Fetch attendance records
export function useAttendance(date?: string) {
  return useSWR(date ? `attendance:${date}` : 'attendance', async () => {
    let query = supabase.from('attendance_records').select('*');
    
    if (date) {
      query = query.eq('attendance_date', date);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  });
}

// Get dashboard metrics
export async function getDashboardMetrics() {
  try {
    const [employees, leaveReqs, attendance] = await Promise.all([
      supabase.from('employees').select('*'),
      supabase.from('leave_requests').select('*').eq('status', 'pending'),
      supabase.from('attendance_records').select('*').eq('attendance_date', new Date().toISOString().split('T')[0])
    ]);

    const totalEmployees = employees.data?.length || 0;
    const activeEmployees = employees.data?.filter((e: any) => e.status === 'active').length || 0;
    const onLeave = employees.data?.filter((e: any) => e.status === 'onleave').length || 0;
    const onboarding = employees.data?.filter((e: any) => e.status === 'onboarding').length || 0;
    const presentToday = attendance.data?.filter((a: any) => a.status === 'present').length || 0;
    const attendancePercent = totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : 0;

    return {
      totalEmployees,
      activeEmployees,
      onLeave,
      onboarding,
      presentToday,
      attendancePercent,
      pendingLeaves: leaveReqs.data?.length || 0
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return {
      totalEmployees: 0,
      activeEmployees: 0,
      onLeave: 0,
      onboarding: 0,
      presentToday: 0,
      attendancePercent: 0,
      pendingLeaves: 0
    };
  }
}
