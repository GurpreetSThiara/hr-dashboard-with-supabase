'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';

interface Employee {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  designation: string;
  employment_type: string;
  manager: string;
  join_date: string;
  status: string;
  attendance_pct: number;
  location: string;
}

interface LeavePolicyRule {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  days_per_year: number;
  color?: string;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approver_notes?: string;
  created_at: string;
}

interface PeerInfo {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  designation: string;
  status: string; // active, onleave, onboarding
  presenceStatus: 'Present' | 'WFH' | 'On Leave' | 'Not Checked In';
  checkInTime?: string;
}

export default function EmployeeDashboardView() {
  const supabase = createClient();
  const { user, profile } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [managerName, setManagerName] = useState<string>('');
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  // Load attendance settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/attendance/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.error('Error fetching attendance settings:', err);
      }
    }
    fetchSettings();
  }, []);

  const checkinAllowed = (() => {
    if (!settings) return true; // Default to true while loading
    if (!settings.enable_checkin_checkout) return false;
    if (profile && Array.isArray(settings.checkin_checkout_allowed_tiers)) {
      return settings.checkin_checkout_allowed_tiers.includes(Number(profile.tier));
    }
    return true;
  })();

  // Attendance states
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [workDuration, setWorkDuration] = useState<string>('0h 0m');
  const [checkInLocation, setCheckInLocation] = useState<'Office' | 'Home'>('Office');
  const [checkInNotes, setCheckInNotes] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Leave states
  const [policies, setPolicies] = useState<LeavePolicyRule[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<Record<string, { total: number; used: number; remaining: number; color: string }>>({});
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  // Leave Form states
  const [formLeaveType, setFormLeaveType] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Peers state
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [peersLoading, setPeersLoading] = useState(false);

  // Realtime channel refs
  const leaveChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  // Tab filtering for leaves
  const [activeLeaveTab, setActiveLeaveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Greet time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' : 'Good evening';

  // 1. Fetch Employee record based on session email
  useEffect(() => {
    async function loadData() {
      if (!user?.email) return;
      try {
        setLoading(true);
        const { data: emp, error } = await supabase
          .from('employees')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (error) throw error;

        if (emp) {
          setEmployee(emp);

          // Fetch manager's name if manager contains email format (@)
          if (emp.manager && emp.manager.includes('@')) {
            const { data: mgr } = await supabase
              .from('employees')
              .select('first_name, last_name')
              .eq('email', emp.manager)
              .maybeSingle();
            if (mgr) {
              setManagerName(`${mgr.first_name} ${mgr.last_name}`);
            } else {
              setManagerName(emp.manager);
            }
          } else {
            setManagerName(emp.manager || 'No Manager assigned');
          }

          // Trigger related fetches
          fetchAttendanceStatus(emp.id);
          fetchLeaveData(emp.id);
          fetchPeers(emp.department, emp.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading employee profile:', err);
        setLoading(false);
      }
    }
    loadData();
  }, [user?.email]);

  // 2. Fetch today's checkin status
  async function fetchAttendanceStatus(empId: string) {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: logsData, error } = await supabase
        .from('checkin_checkout_logs')
        .select('*')
        .eq('employee_id', empId)
        .gte('check_in_time', `${today}T00:00:00.000Z`)
        .lte('check_in_time', `${today}T23:59:59.999Z`)
        .order('check_in_time', { ascending: true });

      if (error) throw error;

      const logsList = logsData || [];
      setTodayLogs(logsList);

      const activeLog = logsList.find(log => !log.check_out_time);

      if (activeLog) {
        setIsCheckedIn(true);
        setCheckInTime(activeLog.check_in_time);
        startLiveDurationTimer(logsList, activeLog.check_in_time);
      } else {
        setIsCheckedIn(false);
        setCheckInTime(null);
        const totalMin = logsList.reduce((acc, l) => acc + (l.duration_minutes || 0), 0);
        const hrs = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        setWorkDuration(`${hrs}h ${mins}m 0s`);
      }
    } catch (err) {
      console.error('Error fetching checkin status:', err);
    } finally {
      setLoading(false);
    }
  }

  // Live work duration timer (updating every second)
  function startLiveDurationTimer(allLogs: any[], activeCheckInStr: string) {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

    const completedMs = allLogs
      .filter(l => l.check_out_time)
      .reduce((acc, l) => {
        const diff = new Date(l.check_out_time).getTime() - new Date(l.check_in_time).getTime();
        return acc + diff;
      }, 0);

    const updateTimer = () => {
      const liveMs = new Date().getTime() - new Date(activeCheckInStr).getTime();
      const totalMs = completedMs + liveMs;
      
      const totalSeconds = Math.floor(totalMs / 1000);
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;

      setWorkDuration(`${hrs}h ${mins}m ${secs}s`);
    };

    updateTimer();
    durationIntervalRef.current = setInterval(updateTimer, 1000);
  }

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  // 3. Fetch leaves & policies
  async function fetchLeaveData(empId: string) {
    try {
      setLeaveLoading(true);
      // Fetch policies
      const policiesRes = await fetch('/api/leave-policies');
      const policiesData = await policiesRes.json();
      const loadedPolicies = (policiesData.policies || []) as LeavePolicyRule[];
      setPolicies(loadedPolicies);

      // Fetch user requests
      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', empId)
        .order('created_at', { ascending: false });

      const loadedLeaves = (leaves || []) as LeaveRequest[];
      setMyLeaves(loadedLeaves);

      // Compute balances in JS
      const currentYear = new Date().getFullYear();
      const balances: Record<string, { total: number; used: number; remaining: number; color: string }> = {};

      const typeColors: Record<string, string> = {
        'Sick Leave': '#ef4444',
        'Vacation': '#10b981',
        'Personal': '#3b82f6',
        'Maternity': '#ec4899',
        'Paternity': '#06b6d4',
        'Unpaid': '#64748b',
        'Annual Leave': '#10b981'
      };

      loadedPolicies.forEach(p => {
        balances[p.leave_type_name] = {
          total: p.days_per_year,
          used: 0,
          remaining: p.days_per_year,
          color: p.color || typeColors[p.leave_type_name] || '#3b82f6'
        };
      });

      // Sum used days for approved leaves in current year
      loadedLeaves.forEach(l => {
        if (l.status === 'approved') {
          const startDate = new Date(l.start_date);
          if (startDate.getFullYear() === currentYear) {
            const name = l.leave_type;
            if (balances[name]) {
              balances[name].used += l.days_count;
              balances[name].remaining = Math.max(0, balances[name].total - balances[name].used);
            }
          }
        }
      });

      setLeaveBalances(balances);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLeaveLoading(false);
    }
  }

  // 4. Fetch department peers and their attendance
  async function fetchPeers(dept: string, myId: string) {
    if (!dept) return;
    try {
      setPeersLoading(true);
      // Fetch peers
      const { data: employees } = await supabase
        .from('employees')
        .select('id, emp_id, first_name, last_name, designation, status')
        .eq('department', dept)
        .neq('id', myId)
        .eq('status', 'active');

      if (!employees || employees.length === 0) {
        setPeers([]);
        return;
      }

      // Fetch today's checkin logs (UTC day bounds, ordered newest-first)
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: logs } = await supabase
        .from('checkin_checkout_logs')
        .select('employee_id, check_in_time, check_out_time, location')
        .gte('check_in_time', `${today}T00:00:00.000Z`)
        .lte('check_in_time', `${today}T23:59:59.999Z`)
        .order('check_in_time', { ascending: false });

      // Fetch leaves active today
      const { data: activeLeaves } = await supabase
        .from('leave_requests')
        .select('employee_id')
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today);

      const leaveEmpIds = new Set(activeLeaves?.map(l => l.employee_id) || []);
      // Prefer the ACTIVE session (no check_out_time). Logs are newest-first,
      // so an active log should win over any completed log for the same employee.
      const logsMap = new Map<string, any>();
      logs?.forEach(log => {
        const existing = logsMap.get(log.employee_id);
        if (!existing) {
          logsMap.set(log.employee_id, log);
        } else if (!log.check_out_time && existing.check_out_time) {
          // current log is active, stored one was completed → replace
          logsMap.set(log.employee_id, log);
        }
      });

      const peerList: PeerInfo[] = employees.map(emp => {
        let presenceStatus: PeerInfo['presenceStatus'] = 'Not Checked In';
        let checkInTime: string | undefined;

        if (leaveEmpIds.has(emp.id)) {
          presenceStatus = 'On Leave';
        } else {
          const log = logsMap.get(emp.id);
          if (log && !log.check_out_time) {
            presenceStatus = log.location === 'Home' ? 'WFH' : 'Present';
            checkInTime = format(new Date(log.check_in_time), 'hh:mm a');
          }
        }

        return {
          id: emp.id,
          emp_id: emp.emp_id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          designation: emp.designation,
          status: emp.status,
          presenceStatus,
          checkInTime
        };
      });

      setPeers(peerList);
    } catch (err) {
      console.error('Error fetching peers:', err);
    } finally {
      setPeersLoading(false);
    }
  }

  // ── Realtime: my leave status + peer presence ──────────────────────────────
  useEffect(() => {
    if (!employee) return;

    const empId = employee.id;
    const empEmail = user?.email ?? '';

    // ── (A) My leaves: status updates ──────────────────────────────────────
    const leaveCh = supabase
      .channel(`my_leaves_${empId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_requests' },
        (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          // Only care about this employee's leaves
          if (row.employee_id !== empId && row.employee_email !== empEmail) return;
          if (row.status === old.status) return;

          // Update in list
          setMyLeaves((prev) =>
            prev.map((l) => (l.id === row.id ? { ...l, ...row } : l))
          );

          // Update leave balances if status changed to/from approved
          if (row.status === 'approved' || old.status === 'approved') {
            fetchLeaveData(empId);
          }

          // Toast notification
          if (row.status === 'approved') {
            toast.success(`Your ${row.leave_type} leave has been approved! ✅`, { duration: 6000 });
          } else if (row.status === 'rejected') {
            toast.error(`Your ${row.leave_type} leave request was rejected.`, {
              description: row.approver_notes ? `Note: ${row.approver_notes}` : undefined,
              duration: 6000,
            });
          }
        }
      )
      // New leave I just submitted
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leave_requests' },
        (payload) => {
          const row = payload.new as any;
          if (row.employee_id !== empId && row.employee_email !== empEmail) return;
          setMyLeaves((prev) => {
            if (prev.some((l) => l.id === row.id)) return prev;
            return [row, ...prev];
          });
        }
      )
      // Deleted leave
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leave_requests' },
        (payload) => {
          const row = payload.old as any;
          setMyLeaves((prev) => prev.filter((l) => l.id !== row.id));
        }
      )
      .subscribe();

    leaveChannelRef.current = leaveCh;

    // ── (B) Peer presence: check-in/out events ──────────────────────────────
    const today = new Date().toISOString().split('T')[0];

    const presenceCh = supabase
      .channel(`peer_presence_${empId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkin_checkout_logs' },
        (payload) => {
          const log = payload.new as any;
          // Check-in happened: update peer presence if it's one of our peers
          setPeers((prev) => {
            const peer = prev.find((p) => p.id === log.employee_id);
            if (!peer) return prev; // not our peer
            const newStatus: PeerInfo['presenceStatus'] =
              log.location === 'Home' ? 'WFH' : 'Present';
            return prev.map((p) =>
              p.id === log.employee_id
                ? {
                    ...p,
                    presenceStatus: newStatus,
                    checkInTime: new Date(log.check_in_time).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  }
                : p
            );
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'checkin_checkout_logs' },
        (payload) => {
          const log = payload.new as any;
          // Only react to check-outs, and only for one of our peers.
          if (!log.check_out_time) return;
          setPeers((prev) => {
            const isPeer = prev.some((p) => p.id === log.employee_id);
            if (isPeer && employee?.department) {
              // Re-derive presence from DB: the peer may still have another
              // active session, or be on leave — don't blindly mark them absent.
              fetchPeers(employee.department, empId);
            }
            return prev;
          });
        }
      )
      .subscribe();

    presenceChannelRef.current = presenceCh;

    return () => {
      if (leaveChannelRef.current) {
        supabase.removeChannel(leaveChannelRef.current);
        leaveChannelRef.current = null;
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [employee?.id, user?.email]);

  // 5. Attendance Actions
  async function handleCheckIn() {
    if (!employee) return;
    try {
      setAttendanceLoading(true);
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('checkin_checkout_logs')
        .insert({
          employee_id: employee.id,
          check_in_time: now,
          location: checkInLocation,
          notes: checkInNotes || null,
          device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
        });

      if (error) throw error;

      setIsCheckedIn(true);
      setCheckInTime(now);
      setCheckInNotes('');
      toast.success('Successfully checked in!');
      fetchAttendanceStatus(employee.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to check in');
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!employee || !checkInTime) return;
    try {
      setAttendanceLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch the log to get its ID
      const { data: log } = await supabase
        .from('checkin_checkout_logs')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!log) {
        toast.error('No active check-in record found');
        return;
      }

      const checkOutTime = new Date().toISOString();
      const durationMs = new Date(checkOutTime).getTime() - new Date(log.check_in_time).getTime();
      const durationMinutes = Math.max(1, Math.floor(durationMs / 60000));

      const { error } = await supabase
        .from('checkin_checkout_logs')
        .update({
          check_out_time: checkOutTime,
          duration_minutes: durationMinutes,
        })
        .eq('id', log.id);

      if (error) throw error;

      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      setIsCheckedIn(false);
      setCheckInTime(null);
      toast.success('Successfully checked out! Have a good day!');
      fetchAttendanceStatus(employee.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to check out');
    } finally {
      setAttendanceLoading(false);
    }
  }

  // 6. Leave Application Submit
  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;

    if (!formLeaveType || !formStartDate || !formEndDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const start = parseISO(formStartDate);
    const end = parseISO(formEndDate);

    if (start > end) {
      toast.error('Start date must be before or equal to End date');
      return;
    }

    const calculatedDays = differenceInDays(end, start) + 1;
    const balance = leaveBalances[formLeaveType];

    if (balance && calculatedDays > balance.remaining) {
      toast.error(`Insufficient balance. You requested ${calculatedDays} days, but only have ${balance.remaining} remaining.`);
      return;
    }

    try {
      setFormSubmitting(true);

      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          employee_email: employee.email,
          leave_type: formLeaveType,
          start_date: formStartDate,
          end_date: formEndDate,
          reason: formReason,
          days_count: calculatedDays
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to submit leave request');

      toast.success('Leave request submitted successfully!');
      setIsLeaveModalOpen(false);
      // Reset form
      setFormLeaveType('');
      setFormStartDate('');
      setFormEndDate('');
      setFormReason('');
      // Reload leave history and balances
      fetchLeaveData(employee.id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to apply leave');
    } finally {
      setFormSubmitting(false);
    }
  }

  // Delete/Cancel Leave Request
  async function handleCancelLeave(leaveId: string) {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', leaveId)
        .eq('status', 'pending'); // Can only delete pending requests

      if (error) throw error;
      toast.success('Leave request cancelled');
      if (employee) fetchLeaveData(employee.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel request');
    }
  }

  const filteredLeaves = myLeaves.filter(
    l => activeLeaveTab === 'all' || l.status === activeLeaveTab
  );

  function calculateTenure(joinDate: string): string {
    const join = new Date(joinDate);
    const now = new Date();
    const months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
    if (months < 1) return 'New hire';
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return remainingMonths > 0 ? `${years}y ${remainingMonths}m` : `${years} yr${years > 1 ? 's' : ''}`;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50 animate-pulse">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-blue-600 mb-2" />
        <p className="text-slate-500">Loading your profile details...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 rounded-xl p-8 text-center shadow-card">
        <Icon name="UserMinusIcon" size={36} className="text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Employee Record Missing</h2>
        <p className="text-sm text-slate-500 mb-6">
          We found an authenticated account for <strong>{user?.email}</strong>, but there is no corresponding record in the employee database.
        </p>
        <p className="text-xs text-slate-400">
          Please request an HR administrator to add your profile in the Employees module.
        </p>
      </div>
    );
  }

  // Render timeline bar for today's logs
  const renderTimelineBar = () => {
    if (todayLogs.length === 0) return null;

    const segments: { left: number; width: number; key: string }[] = [];
    const now = new Date();

    todayLogs.forEach((log) => {
      const checkIn = new Date(log.check_in_time);
      const checkOut = log.check_out_time ? new Date(log.check_out_time) : now;

      // Calculate minutes from midnight (00:00)
      const startMin = checkIn.getHours() * 60 + checkIn.getMinutes();
      const endMin = checkOut.getHours() * 60 + checkOut.getMinutes();

      // Convert to percentages of a 24-hour day (1440 minutes)
      const left = (startMin / 1440) * 100;
      const width = Math.max(1, ((endMin - startMin) / 1440) * 100);

      segments.push({ left, width, key: log.id });
    });

    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider text-left">Today's Timeline Bar</p>
        
        {/* Timeline Bar Track */}
        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
          {segments.map((seg) => (
            <div
              key={seg.key}
              className="absolute top-0 h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            />
          ))}
        </div>

        {/* Labels under track */}
        <div className="flex justify-between text-[9px] text-slate-400 font-mono-data">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>12 AM</span>
        </div>

        {/* List of sessions */}
        <div className="space-y-2 mt-2 max-h-24 overflow-y-auto pr-1 scrollbar-thin text-left">
          {todayLogs.map((log, index) => {
            const inTime = new Date(log.check_in_time);
            const outTime = log.check_out_time ? new Date(log.check_out_time) : null;
            const durationMin = log.duration_minutes || (outTime ? Math.max(1, Math.floor((outTime.getTime() - inTime.getTime()) / 60000)) : Math.max(1, Math.floor((new Date().getTime() - inTime.getTime()) / 60000)));
            const durationStr = `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;

            return (
              <div key={log.id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px]">
                <div className="min-w-0">
                  <p className="font-bold text-slate-700">
                    Session {index + 1} ({log.location})
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono-data mt-0.5">
                    {format(inTime, 'hh:mm a')} - {outTime ? format(outTime, 'hh:mm a') : 'Active'}
                  </p>
                </div>
                <span className="font-bold text-slate-600 flex-shrink-0 bg-white border border-slate-100 px-1.5 py-0.5 rounded">
                  {durationStr}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const initials = (employee.first_name[0] + employee.last_name[0]).toUpperCase();
  const avatarColors = [
    'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
    'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-rose-600',
    'bg-cyan-600', 'bg-orange-600'
  ];
  let colorHash = 0;
  for (let i = 0; i < employee.emp_id.length; i++) colorHash = employee.emp_id.charCodeAt(i) + ((colorHash << 5) - colorHash);
  const avatarBg = avatarColors[Math.abs(colorHash) % avatarColors.length];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Welcoming Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 p-6 sm:p-8 text-white shadow-lg">
        {/* Decorative elements */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 translate-y-12 w-48 h-48 rounded-full bg-white/5 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold border border-white/20 shadow-md ${avatarBg}`}>
              {initials}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                {greeting}, {employee.first_name}!
              </h2>
              <p className="text-sm text-blue-100 mt-1 flex items-center gap-1.5">
                <span className="font-semibold">{employee.designation}</span> · {employee.department}
              </p>
              <p className="text-xs text-blue-200 font-mono mt-0.5">{employee.emp_id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs">
            <Icon name="CalendarIcon" size={14} className="text-blue-200" />
            <div className="font-medium text-slate-100">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Grid: Attendance Tracker, Job Details, Team presence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel A: Modern Attendance Log Card */}
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-5 hover:shadow-card-hover flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="ClockIcon" size={16} className="text-blue-600" />
                Work Attendance
              </h3>
              <span className={`status-badge ${isCheckedIn ? 'status-active' : 'status-terminated'}`}>
                {isCheckedIn ? 'Checked In' : 'Not Active'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center my-3">
              <p className="text-xs text-slate-400 font-medium">Logged hours today</p>
              <p className="text-3xl font-extrabold text-slate-900 font-mono-data mt-1">{workDuration}</p>
              {isCheckedIn && checkInTime && (
                <p className="text-xs text-slate-500 mt-1">
                  Started at {format(new Date(checkInTime), 'hh:mm a')}
                </p>
              )}
            </div>

            {!isCheckedIn && (
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckInLocation('Office')}
                    className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                      checkInLocation === 'Office'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon name="BuildingOfficeIcon" size={14} />
                    At Office
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckInLocation('Home')}
                    className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                      checkInLocation === 'Home'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon name="HomeIcon" size={14} />
                    WFH (Home)
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Notes for today (optional)..."
                  value={checkInNotes}
                  onChange={e => setCheckInNotes(e.target.value)}
                  className="input-field text-xs py-2 bg-slate-50 focus:bg-white"
                />
              </div>
            )}
          </div>

          <div className="mt-6">
            {!checkinAllowed && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs flex items-start gap-2 mt-3 mb-1">
                <Icon name="ExclamationTriangleIcon" size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Check-in restricted</p>
                  <p className="mt-0.5">Logging attendance is currently disabled or restricted for your role by company policy.</p>
                </div>
              </div>
            )}

            {isCheckedIn ? (
              <button
                onClick={handleCheckOut}
                disabled={attendanceLoading || !checkinAllowed}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {attendanceLoading && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                <Icon name="ArrowLeftOnRectangleIcon" size={16} />
                Check Out
              </button>
            ) : (
              <button
                onClick={handleCheckIn}
                disabled={attendanceLoading || !checkinAllowed}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {attendanceLoading && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                <Icon name="ArrowRightOnRectangleIcon" size={16} />
                Check In
              </button>
            )}
          </div>
          {renderTimelineBar()}
        </div>

        {/* Panel B: My Profile Card */}
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-5 hover:shadow-card-hover flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-4">
              <Icon name="UserIcon" size={16} className="text-violet-600" />
              My Job Profile
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3 py-1.5 border-b border-slate-50">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="IdentificationIcon" size={16} className="text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Reports To</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{managerName || 'No Manager assigned'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 py-1.5 border-b border-slate-50">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="MapPinIcon" size={16} className="text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Work Location</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">{employee.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 py-1.5 border-b border-slate-50">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="CalendarIcon" size={16} className="text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Join Date</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {new Date(employee.join_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-xl p-3.5 mt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Tenure</p>
              <p className="text-base font-bold text-indigo-900 mt-0.5">{calculateTenure(employee.join_date)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Employment</p>
              <span className="status-badge bg-indigo-100 text-indigo-700 font-semibold border-transparent mt-0.5">
                {employee.employment_type}
              </span>
            </div>
          </div>
        </div>

        {/* Panel C: Peer Presence Widget */}
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-5 hover:shadow-card-hover flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="UsersIcon" size={16} className="text-emerald-600" />
                Peer Presence ({employee.department})
              </h3>
            </div>

            {peersLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : peers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-slate-400">No active colleagues in department directory</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
                {peers.map(peer => {
                  const statusColors: Record<string, string> = {
                    'Present': 'bg-emerald-500 ring-emerald-100',
                    'WFH': 'bg-sky-500 ring-sky-100',
                    'On Leave': 'bg-purple-500 ring-purple-100',
                    'Not Checked In': 'bg-slate-300 ring-slate-100'
                  };
                  return (
                    <div key={peer.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 transition border border-slate-100/50">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {peer.first_name} {peer.last_name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{peer.designation}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <span className={`w-2.5 h-2.5 rounded-full ring-4 ${statusColors[peer.presenceStatus]}`} />
                          {peer.presenceStatus}
                        </span>
                        {peer.checkInTime && (
                          <span className="text-[10px] text-slate-400 font-mono-data">
                            Checked in: {peer.checkInTime}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-center">
            <span className="text-xs text-slate-400">
              Only displaying team members in {employee.department}
            </span>
          </div>
        </div>

      </div>

      {/* 3. Leave Balances Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Icon name="CalendarDaysIcon" size={20} className="text-blue-600" />
              My Leave Balances ({new Date().getFullYear()})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Track your time off and request leaves directly</p>
          </div>
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition active:scale-95 shadow flex items-center gap-1.5"
          >
            <Icon name="PlusIcon" size={16} />
            Apply Leave
          </button>
        </div>

        {leaveLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : Object.keys(leaveBalances).length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
            No leave policy rules loaded for this role.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(leaveBalances).map(([type, bal]) => {
              const usedPct = bal.total > 0 ? (bal.used / bal.total) * 100 : 0;
              return (
                <div key={type} className="border border-slate-200 hover:border-slate-300 bg-slate-50/30 p-4.5 rounded-xl transition duration-150 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate mr-2">{type}</span>
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: bal.color }}
                      />
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-3xl font-extrabold text-slate-900 font-mono-data">{bal.remaining}</span>
                      <span className="text-xs text-slate-400 font-medium">days left</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Allowance: {bal.total}d</span>
                      <span>Used: {bal.used}d</span>
                    </div>
                    <div className="w-full bg-slate-200/70 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, usedPct)}%`,
                          backgroundColor: bal.color
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Leave History Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header tabs */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">My Leave Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">View and manage leave applications</p>
          </div>
          <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveLeaveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  activeLeaveTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        <div className="divide-y divide-slate-150">
          {filteredLeaves.length === 0 ? (
            <EmptyState
              icon="CalendarIcon"
              title="No Leave Requests Found"
              description={`You have no ${activeLeaveTab === 'all' ? '' : activeLeaveTab} leave requests recorded.`}
            />
          ) : (
            filteredLeaves.map(leave => {
              const statusMap: Record<string, string> = {
                approved: 'status-approved',
                pending: 'status-pending',
                rejected: 'status-rejected'
              };

              const leaveColors: Record<string, string> = {
                'Sick Leave': 'bg-red-50 text-red-700 border border-red-100',
                'Vacation': 'bg-emerald-50 text-emerald-700 border border-emerald-100',
                'Personal': 'bg-blue-50 text-blue-700 border border-blue-100',
                'Annual Leave': 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              };

              return (
                <div key={leave.id} className="p-6 hover:bg-slate-50/50 transition duration-150">
                  <div className="flex items-start justify-between gap-6 flex-wrap md:flex-nowrap">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${leaveColors[leave.leave_type] || 'bg-slate-100 text-slate-700'}`}>
                          {leave.leave_type}
                        </span>
                        <span className={`status-badge ${statusMap[leave.status]}`}>
                          {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono-data">
                          Applied: {new Date(leave.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Icon name="CalendarIcon" size={14} className="text-slate-400" />
                        {new Date(leave.start_date).toLocaleDateString()} to {new Date(leave.end_date).toLocaleDateString()}
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md ml-1.5">
                          {leave.days_count} day{leave.days_count > 1 ? 's' : ''}
                        </span>
                      </div>

                      {leave.reason && (
                        <p className="text-sm text-slate-600">
                          <span className="font-semibold text-slate-800">Reason:</span> {leave.reason}
                        </p>
                      )}

                      {leave.approver_notes && (
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 max-w-2xl text-xs text-slate-600">
                          <span className="font-bold text-slate-700">Approver Notes:</span> {leave.approver_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 self-center md:self-auto text-right">
                      {leave.status === 'pending' ? (
                        <button
                          onClick={() => handleCancelLeave(leave.id)}
                          className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Icon name="TrashIcon" size={12} />
                          Cancel Request
                        </button>
                      ) : (
                        <div className="text-xs text-slate-400">
                          Processed
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Custom Modal: Apply Leave */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Icon name="CalendarDaysIcon" size={18} className="text-blue-600" />
                Apply for Leave
              </h3>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Leave Type *</label>
                <select
                  required
                  value={formLeaveType}
                  onChange={e => setFormLeaveType(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select a leave type</option>
                  {Object.keys(leaveBalances).map(type => (
                    <option key={type} value={type}>
                      {type} (Remaining: {leaveBalances[type].remaining} days)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {formStartDate && formEndDate && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 flex items-center justify-between">
                  <span className="font-medium">Total requested duration:</span>
                  <span className="font-extrabold text-sm">
                    {(() => {
                      const start = parseISO(formStartDate);
                      const end = parseISO(formEndDate);
                      if (start > end) return 'Invalid range';
                      const count = differenceInDays(end, start) + 1;
                      return `${count} day${count !== 1 ? 's' : ''}`;
                    })()}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Reason for leave *</label>
                <textarea
                  required
                  placeholder="Please state a brief reason for your leave request..."
                  value={formReason}
                  onChange={e => setFormReason(e.target.value)}
                  className="input-field min-h-[90px] resize-none"
                  maxLength={500}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold flex items-center justify-center gap-1.5 shadow"
                >
                  {formSubmitting && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
