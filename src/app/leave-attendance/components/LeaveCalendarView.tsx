'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, isToday } from 'date-fns';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

const LEAVE_COLORS: Record<string, string> = {
  'Vacation': 'bg-blue-100 border-blue-300',
  'Sick Leave': 'bg-red-100 border-red-300',
  'Personal Leave': 'bg-amber-100 border-amber-300',
  'Maternity Leave': 'bg-pink-100 border-pink-300',
  'Paternity Leave': 'bg-cyan-100 border-cyan-300',
  'Unpaid Leave': 'bg-gray-100 border-gray-300',
};

export default function LeaveCalendarView() {
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    fetchLeaves();
  }, []);

  async function fetchLeaves() {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'approved')
        .order('start_date', { ascending: true });

      setLeaves(data || []);
    } catch (error) {
      toast.error('Failed to fetch leave data');
    } finally {
      setLoading(false);
    }
  }

  // ── Realtime: sync approved leaves on calendar ─────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('calendar_live')

      // Leave approved → add to calendar
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leave_requests' }, (payload) => {
        const newRow = payload.new as LeaveRequest;
        const oldRow = payload.old as LeaveRequest;

        if (newRow.status === 'approved' && oldRow.status !== 'approved') {
          // Newly approved → add
          setLeaves((prev) => {
            if (prev.some((l) => l.id === newRow.id)) return prev;
            return [...prev, newRow].sort((a, b) => a.start_date.localeCompare(b.start_date));
          });
        } else if (newRow.status !== 'approved' && oldRow.status === 'approved') {
          // Un-approved (rejected/deleted) → remove
          setLeaves((prev) => prev.filter((l) => l.id !== newRow.id));
        } else if (newRow.status === 'approved') {
          // Updated approved leave (dates changed) → update in place
          setLeaves((prev) => prev.map((l) => (l.id === newRow.id ? { ...l, ...newRow } : l)));
        }
      })

      // New leave inserted as approved (rare but possible)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leave_requests' }, (payload) => {
        const row = payload.new as LeaveRequest;
        if (row.status === 'approved') {
          setLeaves((prev) => {
            if (prev.some((l) => l.id === row.id)) return prev;
            return [...prev, row].sort((a, b) => a.start_date.localeCompare(b.start_date));
          });
        }
      })

      // Deleted leave → remove from calendar
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leave_requests' }, (payload) => {
        const row = payload.old as { id: string };
        setLeaves((prev) => prev.filter((l) => l.id !== row.id));
      })

      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      setIsLive(false);
    };
  }, []);

  function isDateInLeave(date: Date): LeaveRequest[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    return leaves.filter(leave => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const checkDate = new Date(dateStr);
      return checkDate >= start && checkDate <= end;
    });
  }

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const firstDayOfWeek = startOfMonth(currentDate).getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Leave Calendar - {format(currentDate, 'MMMM yyyy')}
            <span className={`flex items-center gap-1 text-[10px] font-semibold ml-2 ${isLive ? 'text-emerald-600' : 'text-slate-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              {isLive ? 'Live' : '—'}
            </span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4">
        {Object.entries(LEAVE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 text-sm">
            <div className={`w-3 h-3 rounded border ${color}`}></div>
            <span className="text-slate-600">{type}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">Loading calendar...</div>
        ) : (
          <>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-slate-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {emptyDays.map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square bg-slate-50 rounded-lg"></div>
              ))}

              {/* Days of month */}
              {monthDays.map(date => {
                const dateLeaves = isDateInLeave(date);
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isDayToday = isToday(date);

                return (
                  <div
                    key={format(date, 'yyyy-MM-dd')}
                    onClick={() => setSelectedDate(format(date, 'yyyy-MM-dd'))}
                    className={`aspect-square rounded-lg border-2 p-1 cursor-pointer transition ${
                      isCurrentMonth
                        ? isDayToday
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-blue-300'
                        : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}`}>
                      {format(date, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dateLeaves.slice(0, 2).map(leave => (
                        <div
                          key={leave.id}
                          className={`text-xs px-1 py-0.5 rounded truncate border ${LEAVE_COLORS[leave.leave_type as keyof typeof LEAVE_COLORS] || LEAVE_COLORS['Vacation']}`}
                          title={leave.employee_name}
                        >
                          {leave.employee_name.split(' ')[0]}
                        </div>
                      ))}
                      {dateLeaves.length > 2 && (
                        <div className="text-xs text-slate-500 px-1">+{dateLeaves.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
          <h3 className="font-semibold mb-3">Leaves on {format(new Date(selectedDate), 'MMMM d, yyyy')}</h3>
          {isDateInLeave(new Date(selectedDate)).length === 0 ? (
            <p className="text-sm text-slate-500">No leaves scheduled</p>
          ) : (
            <div className="space-y-2">
              {isDateInLeave(new Date(selectedDate)).map(leave => (
                <div key={leave.id} className="text-sm bg-white p-3 rounded border border-slate-200">
                  <p className="font-medium">{leave.employee_name}</p>
                  <p className="text-xs text-slate-600">{leave.leave_type}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
