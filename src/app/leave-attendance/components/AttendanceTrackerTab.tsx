'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  isWeekend
} from 'date-fns';

interface Employee {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
}

interface CheckinLog {
  id: string;
  employee_id: string;
  check_in_time: string;
  check_out_time: string | null;
  duration_minutes: number | null;
  location: string;
  device: string;
  notes: string | null;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface AttendanceTrackerTabProps {
  onSwitchTab?: (tab: 'leave-requests' | 'leave-calendar' | 'attendance' | 'regularizations', prefillDate?: string) => void;
}

export default function AttendanceTrackerTab({ onSwitchTab }: AttendanceTrackerTabProps) {
  const supabase = createClient();
  const { user, profile } = useAuth();

  // Settings & Permission
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // View States
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('');
  const [currentUserEmpId, setCurrentUserEmpId] = useState<string>('');
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // HR Dropdown States
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const isHrOrManager = [
    'Super Admin',
    'Owner',
    'Admin',
    'HR Admin',
    'HR Manager',
    'HR Executive',
    'Director',
    'Manager'
  ].includes(profile?.role || '');

  // 1. Fetch settings on load
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/attendance/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  // 2. Fetch all employees if HR/Manager, and current employee profile
  useEffect(() => {
    async function loadEmployeeProfiles() {
      if (!user?.email) return;

      try {
        // Fetch current user's employee record
        const { data: myEmp, error: myEmpErr } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .eq('email', user.email)
          .maybeSingle();

        if (myEmp) {
          setCurrentUserEmpId(myEmp.id);
          // Default selection is current user
          setSelectedEmployeeId(myEmp.id);
          setSelectedEmployeeName(`${myEmp.first_name} ${myEmp.last_name}`);
        }

        // If HR/Manager, load all employees for the dropdown
        if (isHrOrManager) {
          const { data: allEmps, error: allEmpsErr } = await supabase
            .from('employees')
            .select('id, emp_id, first_name, last_name, department, designation')
            .eq('status', 'active')
            .order('first_name', { ascending: true });

          if (allEmps) {
            setEmployees(allEmps);
          }
        }
      } catch (err) {
        console.error('Error loading employee profile(s):', err);
      }
    }

    loadEmployeeProfiles();
  }, [user?.email, profile?.role]);

  // 3. Fetch logs and leaves when selected employee or date changes
  useEffect(() => {
    async function fetchAttendanceData() {
      if (!selectedEmployeeId) return;

      try {
        setLoadingData(true);
        let startStr = '';
        let endStr = '';

        if (viewMode === 'month') {
          startStr = format(startOfMonth(currentDate), 'yyyy-MM-dd');
          endStr = format(endOfMonth(currentDate), 'yyyy-MM-dd');
        } else if (viewMode === 'week') {
          startStr = format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
          endStr = format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        } else {
          // List view loads past 6 months to give a rich view
          startStr = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
          endStr = format(new Date(), 'yyyy-MM-dd');
        }

        // Fetch logs
        const { data: logsData, error: logsErr } = await supabase
          .from('checkin_checkout_logs')
          .select('*')
          .eq('employee_id', selectedEmployeeId)
          .gte('check_in_time', `${startStr}T00:00:00.000Z`)
          .lte('check_in_time', `${endStr}T23:59:59.999Z`)
          .order('check_in_time', { ascending: false });

        if (logsErr) throw logsErr;
        setLogs(logsData || []);

        // Fetch approved leave requests
        const { data: leavesData, error: leavesErr } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('employee_id', selectedEmployeeId)
          .eq('status', 'approved')
          .gte('end_date', startStr)
          .lte('start_date', endStr);

        if (leavesErr) throw leavesErr;
        setLeaves(leavesData || []);
      } catch (err) {
        console.error('Error fetching attendance data:', err);
        toast.error('Failed to load attendance logs');
      } finally {
        setLoadingData(false);
      }
    }

    fetchAttendanceData();
  }, [selectedEmployeeId, currentDate, viewMode]);

  // Determine role access configuration
  const checkinAllowed = (() => {
    if (!settings) return true;
    if (!settings.enable_checkin_checkout) return false;
    if (profile && Array.isArray(settings.checkin_checkout_allowed_tiers)) {
      return settings.checkin_checkout_allowed_tiers.includes(Number(profile.tier));
    }
    return true;
  })();

  // Helper: map a date to check-in log and leave status
  function getDayStatus(date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayLogs = logs.filter((log) => {
      const logDate = format(new Date(log.check_in_time), 'yyyy-MM-dd');
      return logDate === dateStr;
    });

    const isDayWeekend = isWeekend(date);

    // Check if on approved leave
    const onLeave = leaves.some((leave) => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      // Strip time
      const checkDate = new Date(dateStr);
      return checkDate >= start && checkDate <= end;
    });

    if (dayLogs.length > 0) {
      // Find earliest check-in of the day
      const earliestLog = [...dayLogs].sort(
        (a, b) => new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime()
      )[0];
      const checkInHour = new Date(earliestLog.check_in_time).getHours();

      // Check if location is Home (WFH)
      const isWFH = earliestLog.location === 'Home';

      // Standard Late Check-in: check-in at or after 10:00 AM
      const isLate = checkInHour >= 10;

      return {
        hasLog: true,
        logs: dayLogs,
        status: isWFH ? 'wfh' : isLate ? 'late' : 'present',
        earliestLog,
      };
    }

    if (onLeave) {
      return { hasLog: false, logs: [], status: 'leave' };
    }

    if (isDayWeekend) {
      return { hasLog: false, logs: [], status: 'weekend' };
    }

    // If day is today and no check-in
    if (isToday(date)) {
      return { hasLog: false, logs: [], status: 'pending-today' };
    }

    // If date is in the future
    if (date > new Date()) {
      return { hasLog: false, logs: [], status: 'future' };
    }

    // Past weekday with no checkin log = absent
    return { hasLog: false, logs: [], status: 'absent' };
  }

  // Generate Calendar cells
  const getMonthDaysArray = () => {
    const startMonth = startOfMonth(currentDate);
    const endMonth = endOfMonth(currentDate);
    const startCal = startOfWeek(startMonth, { weekStartsOn: 0 });
    const endCal = endOfWeek(endMonth, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startCal, end: endCal });
  };

  const getWeekDaysArray = () => {
    const startW = startOfWeek(currentDate, { weekStartsOn: 0 });
    const endW = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: startW, end: endW });
  };

  const filteredEmployees = employees.filter((emp) =>
    `${emp.first_name} ${emp.last_name} ${emp.emp_id}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const selectedDateStatus = getDayStatus(selectedDate);

  // Status Styling Dictionary
  const STATUS_CONFIG: Record<string, { label: string; ringClass: string; bgClass: string; textClass: string; dotClass: string }> = {
    present: {
      label: 'Present (Office)',
      ringClass: 'ring-emerald-500 border-emerald-300',
      bgClass: 'bg-emerald-50 hover:bg-emerald-100/70',
      textClass: 'text-emerald-700',
      dotClass: 'bg-emerald-500'
    },
    wfh: {
      label: 'WFH (Home)',
      ringClass: 'ring-sky-500 border-sky-300',
      bgClass: 'bg-sky-50 hover:bg-sky-100/70',
      textClass: 'text-sky-700',
      dotClass: 'bg-sky-500'
    },
    late: {
      label: 'Late Check-in',
      ringClass: 'ring-amber-500 border-amber-300',
      bgClass: 'bg-amber-50 hover:bg-amber-100/70',
      textClass: 'text-amber-700',
      dotClass: 'bg-amber-500'
    },
    leave: {
      label: 'On Leave',
      ringClass: 'ring-purple-500 border-purple-300',
      bgClass: 'bg-purple-50 hover:bg-purple-100/70',
      textClass: 'text-purple-700',
      dotClass: 'bg-purple-500'
    },
    absent: {
      label: 'Absent',
      ringClass: 'ring-rose-500 border-rose-300',
      bgClass: 'bg-rose-50 hover:bg-rose-100/70',
      textClass: 'text-rose-700',
      dotClass: 'bg-rose-500'
    },
    weekend: {
      label: 'Weekend',
      ringClass: 'ring-slate-200 border-slate-200',
      bgClass: 'bg-slate-50 text-slate-400 hover:bg-slate-100/40',
      textClass: 'text-slate-400',
      dotClass: 'bg-slate-300'
    },
    'pending-today': {
      label: 'Not Checked In',
      ringClass: 'ring-indigo-300 border-indigo-200 border-dashed animate-pulse',
      bgClass: 'bg-indigo-50/50 hover:bg-indigo-100/50',
      textClass: 'text-indigo-600',
      dotClass: 'bg-indigo-400'
    },
    future: {
      label: 'Scheduled',
      ringClass: 'ring-slate-100 border-slate-100 border-dashed',
      bgClass: 'bg-slate-50/30 text-slate-300 cursor-not-allowed',
      textClass: 'text-slate-300',
      dotClass: 'bg-slate-200'
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Global Policy Warning Banner */}
      {!loadingSettings && !checkinAllowed && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-800">Attendance Policy Restrictions Active</h4>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Check-in/out features are currently restricted or turned off by the HR Administrator. 
              You can still review your attendance history and request regularizations for past dates.
            </p>
          </div>
        </div>
      )}

      {/* 2. Controls Panel */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        {/* Left: Employee Selection (HR only) */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Viewing Profile</span>
          </div>

          {isHrOrManager ? (
            <div className="relative w-full sm:w-64">
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/70 transition font-semibold text-slate-700 text-left"
              >
                <span className="truncate">{selectedEmployeeName}</span>
                <ChevronRight className="w-4 h-4 transform rotate-90 text-slate-400 flex-shrink-0" />
              </button>

              {showDropdown && (
                <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1">
                    {filteredEmployees.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400">No employees found</div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            setSelectedEmployeeName(`${emp.first_name} ${emp.last_name}`);
                            setShowDropdown(false);
                            setSearchQuery('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex flex-col ${
                            selectedEmployeeId === emp.id
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-bold">{emp.first_name} {emp.last_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.emp_id} · {emp.department}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
              {selectedEmployeeName}
            </span>
          )}
        </div>

        {/* Right: View Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          {(['month', 'week', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                viewMode === mode
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {mode} View
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Data Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar / List Grid Panel */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          {/* Navigation Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">
                {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
                {viewMode === 'week' && `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d, yyyy')}`}
                {viewMode === 'list' && 'Attendance Logs History'}
              </h3>
            </div>

            {viewMode !== 'list' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
                    if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-lg"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
                    if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Calendar Body */}
          <div className="p-6 flex-1">
            {loadingData ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Clock className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <p className="text-xs">Loading attendance details...</p>
              </div>
            ) : viewMode === 'month' ? (
              <div className="space-y-4">
                {/* Week Day Labels */}
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="text-center text-xs font-bold text-slate-400 py-1 uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Month Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {getMonthDaysArray().map((date, idx) => {
                    const isCurrentM = isSameMonth(date, currentDate);
                    const isSelected = isSameDay(date, selectedDate);
                    const { status, earliestLog } = getDayStatus(date);
                    const config = STATUS_CONFIG[status];

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={`aspect-square p-1.5 rounded-xl border flex flex-col justify-between text-left transition select-none ${
                          isCurrentM ? '' : 'opacity-40'
                        } ${config.bgClass} ${
                          isSelected
                            ? 'ring-2 ring-blue-500 border-blue-500'
                            : 'border-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-xs font-extrabold ${isToday(date) ? 'bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full' : config.textClass}`}>
                            {format(date, 'd')}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
                        </div>

                        {/* Earliest checkin if any */}
                        {earliestLog && (
                          <div className="hidden sm:block mt-1 font-mono-data text-[9px] text-slate-500 truncate leading-none">
                            In: {format(new Date(earliestLog.check_in_time), 'hh:mm a')}
                          </div>
                        )}
                        {earliestLog?.check_out_time && (
                          <div className="hidden sm:block font-mono-data text-[9px] text-slate-400 truncate leading-none mt-0.5">
                            Out: {format(new Date(earliestLog.check_out_time), 'hh:mm a')}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : viewMode === 'week' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-3">
                  {getWeekDaysArray().map((date, idx) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const { status, earliestLog } = getDayStatus(date);
                    const config = STATUS_CONFIG[status];

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition select-none ${config.bgClass} ${
                          isSelected
                            ? 'ring-2 ring-blue-500 border-blue-500'
                            : 'border-slate-100'
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {format(date, 'EEE')}
                        </span>
                        <span className={`text-base font-black ${isToday(date) ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full' : config.textClass}`}>
                          {format(date, 'd')}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
                        {earliestLog && (
                          <span className="font-mono-data text-[9px] text-slate-500 mt-1">
                            {format(new Date(earliestLog.check_in_time), 'hh:mm a')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* List View Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 px-4">Status</th>
                      <th className="pb-3 px-4">Check-In</th>
                      <th className="pb-3 px-4">Check-Out</th>
                      <th className="pb-3 px-4">Duration</th>
                      <th className="pb-3 px-4">Location</th>
                      <th className="pb-3 pl-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No check-in logs found for this period.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const inDate = new Date(log.check_in_time);
                        const { status } = getDayStatus(inDate);
                        const config = STATUS_CONFIG[status];
                        const durationHrs = log.duration_minutes 
                          ? `${Math.floor(log.duration_minutes / 60)}h ${log.duration_minutes % 60}m` 
                          : '--';

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="py-3 pr-4 font-semibold text-slate-800">
                              {format(inDate, 'MMM d, yyyy')}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bgClass} ${config.textClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
                                {log.location === 'Home' ? 'WFH' : 'Present'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono-data text-slate-500">
                              {format(inDate, 'hh:mm:ss a')}
                            </td>
                            <td className="py-3 px-4 font-mono-data text-slate-500">
                              {log.check_out_time ? format(new Date(log.check_out_time), 'hh:mm:ss a') : '--'}
                            </td>
                            <td className="py-3 px-4 font-mono-data font-bold text-slate-700">
                              {durationHrs}
                            </td>
                            <td className="py-3 px-4 text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {log.location}
                            </td>
                            <td className="py-3 pl-4 max-w-[200px] truncate text-slate-400" title={log.notes || ''}>
                              {log.notes || '--'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Legend Footer */}
          {viewMode !== 'list' && (
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap gap-4 items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Legend:</span>
              {Object.entries(STATUS_CONFIG)
                .filter(([key]) => !['future'].includes(key))
                .map(([key, config]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <span className={`w-2.5 h-2.5 rounded-full ${config.dotClass}`} />
                    <span>{config.label}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Detailed Info / Actions Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selected Date</span>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </h3>
            </div>

            {/* Date Details Info Box */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                <span className="text-xs text-slate-400 font-semibold">Attendance Status</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${STATUS_CONFIG[selectedDateStatus.status].bgClass} ${STATUS_CONFIG[selectedDateStatus.status].textClass}`}>
                  <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selectedDateStatus.status].dotClass}`} />
                  {STATUS_CONFIG[selectedDateStatus.status].label}
                </span>
              </div>

              {selectedDateStatus.hasLog ? (
                <div className="space-y-3 pt-1">
                  {selectedDateStatus.logs.map((log, index) => (
                    <div key={log.id} className="text-xs space-y-2 border-b border-dashed border-slate-200/50 pb-3 last:border-none last:pb-0">
                      {selectedDateStatus.logs.length > 1 && (
                        <p className="font-bold text-blue-600">Session {selectedDateStatus.logs.length - index}</p>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Check-in Time</span>
                        <span className="font-mono-data text-slate-700 font-semibold">
                          {format(new Date(log.check_in_time), 'hh:mm:ss a')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Check-out Time</span>
                        <span className="font-mono-data text-slate-700 font-semibold">
                          {log.check_out_time ? format(new Date(log.check_out_time), 'hh:mm:ss a') : 'Still active'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Duration</span>
                        <span className="font-mono-data text-slate-800 font-bold">
                          {log.duration_minutes 
                            ? `${Math.floor(log.duration_minutes / 60)}h ${log.duration_minutes % 60}m` 
                            : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Device</span>
                        <span className="text-slate-600">{log.device}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Location</span>
                        <span className="text-slate-600 font-medium">{log.location}</span>
                      </div>
                      {log.notes && (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/50 mt-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Notes</p>
                          <p className="text-slate-600 font-medium mt-0.5">{log.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center space-y-2">
                  <Info className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-400 leading-normal">
                    {selectedDateStatus.status === 'weekend' && 'No logs required for weekends.'}
                    {selectedDateStatus.status === 'leave' && 'User was on approved leave on this day.'}
                    {selectedDateStatus.status === 'future' && 'This is a future date.'}
                    {selectedDateStatus.status === 'pending-today' && 'Today has not been logged yet.'}
                    {selectedDateStatus.status === 'absent' && 'No attendance logs were found for this business day.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions / Request Regularization Link */}
          {selectedDateStatus.status === 'absent' && selectedEmployeeId === currentUserEmpId && onSwitchTab && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onSwitchTab('regularizations', format(selectedDate, 'yyyy-MM-dd'))}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-95"
              >
                <FileText className="w-4 h-4" />
                Apply for Regularization
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
