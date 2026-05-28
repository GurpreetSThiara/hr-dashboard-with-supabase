'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';

type EmployeeStatus = 'active' | 'onleave' | 'onboarding' | 'terminated';
type EmploymentType = 'Full-Time' | 'Part-Time' | 'Contractor' | 'Intern';

interface Employee {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  designation: string;
  employment_type: EmploymentType;
  manager: string;
  join_date: string;
  status: EmployeeStatus;
  attendance_pct: number;
  salary_band: string;
  location: string;
}

interface LeaveRecord {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string;
  days: number;
}

interface Props {
  employee: Employee | null;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
  canEdit: boolean;
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-rose-600',
  'bg-cyan-600', 'bg-orange-600',
];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function calcTenure(joinDate: string): string {
  const join = new Date(joinDate);
  const now = new Date();
  const totalMonths = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
  if (totalMonths < 1) return 'New hire';
  if (totalMonths < 12) return `${totalMonths}mo`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years}y ${months}mo` : `${years} yr${years > 1 ? 's' : ''}`;
}

const LEAVE_STATUS_STYLE: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Sales: 'bg-amber-100 text-amber-700',
  Finance: 'bg-emerald-100 text-emerald-700',
  HR: 'bg-violet-100 text-violet-700',
  Operations: 'bg-orange-100 text-orange-700',
  Legal: 'bg-slate-100 text-slate-700',
  Design: 'bg-cyan-100 text-cyan-700',
};

export default function EmployeeProfileDrawer({ employee, onClose, onEdit, canEdit }: Props) {
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!employee) return;
    setLeaveLoading(true);
    supabase
      .from('leave_requests')
      .select('id, leave_type, start_date, end_date, status, reason, days')
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setLeaveRecords(data || []);
        setLeaveLoading(false);
      });
  }, [employee?.id]);

  if (!employee) return null;

  const avatarColor = getAvatarColor(employee.emp_id);
  const tenure = calcTenure(employee.join_date);
  const attendanceColor =
    employee.attendance_pct >= 90 ? 'text-emerald-600' :
    employee.attendance_pct >= 75 ? 'text-amber-600' : 'text-red-600';
  const attendanceBarColor =
    employee.attendance_pct >= 90 ? 'bg-emerald-500' :
    employee.attendance_pct >= 75 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[420px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Employee Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile hero */}
          <div className="px-5 py-6 bg-gradient-to-br from-slate-50 to-blue-50 border-b border-slate-200">
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0 ${avatarColor}`}>
                {employee.first_name[0]}{employee.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {employee.first_name} {employee.last_name}
                  </h3>
                  <StatusBadge status={employee.status} />
                </div>
                <p className="text-sm text-slate-600">{employee.designation}</p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{employee.emp_id}</p>
                <p className="text-sm text-slate-500 mt-1.5 truncate">{employee.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${DEPT_COLORS[employee.department] || 'bg-slate-100 text-slate-600'}`}>
                {employee.department}
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600">
                {employee.employment_type}
              </span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 border-b border-slate-200">
            {[
              { label: 'Attendance', value: `${employee.attendance_pct}%`, colorClass: attendanceColor },
              { label: 'Tenure', value: tenure, colorClass: 'text-blue-600' },
              { label: 'Band', value: employee.salary_band, colorClass: 'text-violet-600' },
            ].map(({ label, value, colorClass }) => (
              <div key={label} className="py-4 text-center border-r last:border-r-0 border-slate-200">
                <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Details */}
          <div className="px-5 py-5 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Details</p>
            <div className="space-y-3.5">
              {[
                { icon: 'UserIcon', label: 'Reports To', value: employee.manager || '—' },
                { icon: 'MapPinIcon', label: 'Location', value: employee.location },
                { icon: 'CalendarDaysIcon', label: 'Join Date', value: new Date(employee.join_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
                { icon: 'BriefcaseIcon', label: 'Employment', value: employee.employment_type },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name={icon as any} size={15} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance bar */}
          <div className="px-5 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attendance Rate</p>
              <span className={`text-sm font-bold ${attendanceColor}`}>{employee.attendance_pct}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${attendanceBarColor}`}
                style={{ width: `${employee.attendance_pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {employee.attendance_pct >= 90 ? 'Excellent attendance' :
               employee.attendance_pct >= 75 ? 'Average attendance' : 'Below threshold — review needed'}
            </p>
          </div>

          {/* Leave history */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Recent Leave Requests</p>
            {leaveLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : leaveRecords.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No leave requests found</p>
            ) : (
              <div className="space-y-2">
                {leaveRecords.map(lr => (
                  <div key={lr.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{lr.leave_type}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(lr.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' – '}
                        {new Date(lr.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {lr.days ? ` · ${lr.days}d` : ''}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${LEAVE_STATUS_STYLE[lr.status] || 'bg-slate-100 text-slate-600'}`}>
                      {lr.status.charAt(0).toUpperCase() + lr.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="px-5 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
            <button
              onClick={() => onEdit(employee)}
              className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="PencilIcon" size={16} />
              Edit Employee
            </button>
          </div>
        )}
      </div>
    </>
  );
}
