'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, eachDayOfInterval, startOfMonth, endOfMonth,
  isSameMonth, isToday, isWeekend, parseISO,
} from 'date-fns';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';
import Icon from '@/components/ui/AppIcon';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  holiday_type: 'mandatory' | 'optional';
  description?: string;
  is_long_weekend?: boolean;
  long_weekend_start?: string;
  long_weekend_end?: string;
  long_weekend_days?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LEAVE_COLORS: Record<string, string> = {
  'Vacation':         'bg-blue-100 border-blue-300 text-blue-800',
  'Sick Leave':       'bg-red-100 border-red-300 text-red-800',
  'Personal Leave':   'bg-amber-100 border-amber-300 text-amber-800',
  'Maternity Leave':  'bg-pink-100 border-pink-300 text-pink-800',
  'Paternity Leave':  'bg-cyan-100 border-cyan-300 text-cyan-800',
  'Unpaid Leave':     'bg-gray-100 border-gray-300 text-gray-700',
};

const DEFAULT_LEAVE_COLOR = 'bg-violet-100 border-violet-300 text-violet-800';

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeaveCalendarView() {
  const supabase = createClient();

  const [currentDate, setCurrentDate]     = useState(new Date());
  const [leaves, setLeaves]               = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays]           = useState<Holiday[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [selectedDate, setSelectedDate]   = useState<string | null>(null);
  const [isLive, setIsLive]               = useState(false);
  const [showHolidays, setShowHolidays]   = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── Fetch approved leaves via API ────────────────────────────────────────
  const fetchLeaves = useCallback(async () => {
    try {
      setLeavesLoading(true);
      const res = await fetch('/api/leave-requests?status=approved&limit=500');
      if (!res.ok) throw new Error('Failed to fetch leaves');
      const data = await res.json();
      setLeaves(data.data || []);
    } catch {
      toast.error('Failed to fetch leave data');
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  // ── Fetch holidays for current year ─────────────────────────────────────
  useEffect(() => {
    const year = currentDate.getFullYear();
    fetch(`/api/holidays?year=${year}`)
      .then(r => r.json())
      .then(d => setHolidays(d.holidays || []))
      .catch(() => {/* non-fatal */});
  }, [currentDate.getFullYear()]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  // ── Realtime (cache-invalidation pattern) ────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('calendar_live_v2')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leave_requests' }, () => fetchLeaves())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leave_requests' }, () => fetchLeaves())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leave_requests' }, (payload) => {
        const row = payload.old as { id: string };
        setLeaves(prev => prev.filter(l => l.id !== row.id));
      })
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'));

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; setIsLive(false); };
  }, [fetchLeaves]);

  // ── Derived lookups ──────────────────────────────────────────────────────
  const holidayMap = new Map<string, Holiday[]>();
  holidays.forEach(h => {
    const d = h.date.slice(0, 10);
    if (!holidayMap.has(d)) holidayMap.set(d, []);
    holidayMap.get(d)!.push(h);
  });

  function leavesOnDate(date: Date): LeaveRequest[] {
    const ds = format(date, 'yyyy-MM-dd');
    return leaves.filter(l => l.start_date <= ds && l.end_date >= ds);
  }

  const monthDays  = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const emptyCount = startOfMonth(currentDate).getDay();

  // Long weekends in current month
  const longWeekends = holidays.filter(h => {
    if (!h.is_long_weekend || !h.long_weekend_start) return false;
    const lws = parseISO(h.long_weekend_start);
    return lws.getMonth() === currentDate.getMonth() && lws.getFullYear() === currentDate.getFullYear();
  });
  // deduplicate by long_weekend_start
  const uniqueLongWeekends = [...new Map(longWeekends.filter(h => h.long_weekend_start).map(h => [h.long_weekend_start, h])).values()];

  // Next upcoming holiday (from today)
  const today = format(new Date(), 'yyyy-MM-dd');
  const nextHoliday = [...holidays]
    .filter(h => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <div className="space-y-4">
      {/* Info banner — next holiday + long weekends */}
      {(nextHoliday || uniqueLongWeekends.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {nextHoliday && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="SunIcon" size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-800">Next Holiday</p>
                <p className="text-sm font-bold text-amber-900">{nextHoliday.name}</p>
                <p className="text-xs text-amber-600">
                  {new Date(nextHoliday.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                  {' '}· {nextHoliday.holiday_type}
                </p>
              </div>
            </div>
          )}
          {uniqueLongWeekends.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="StarIcon" size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-800">Long Weekend{uniqueLongWeekends.length > 1 ? 's' : ''} this month</p>
                {uniqueLongWeekends.map(lw => (
                  <p key={lw.id} className="text-xs text-emerald-700 font-medium">
                    {new Date(lw.long_weekend_start!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' – '}
                    {new Date(lw.long_weekend_end!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    <span className="ml-1 text-emerald-500">({lw.long_weekend_days}d off)</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main calendar card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Leave Calendar — {format(currentDate, 'MMMM yyyy')}
              <span className={`flex items-center gap-1 text-[10px] font-semibold ml-1 ${isLive ? 'text-emerald-600' : 'text-slate-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                {isLive ? 'Live' : '—'}
              </span>
            </h2>

            <div className="flex items-center gap-2">
              {/* Holiday toggle */}
              <button
                onClick={() => setShowHolidays(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  showHolidays
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <Icon name="SunIcon" size={12} />
                Holidays
              </button>

              <div className="flex gap-1">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                  className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                  Today
                </button>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                  className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-x-4 gap-y-1.5">
          {Object.entries(LEAVE_COLORS).map(([type, cls]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className={`w-3 h-3 rounded border ${cls}`} />
              {type}
            </div>
          ))}
          {showHolidays && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-3 h-3 rounded bg-amber-200 border border-amber-400" />
                Mandatory holiday
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-3 h-3 rounded bg-sky-100 border border-sky-300" />
                Optional holiday
              </div>
            </>
          )}
        </div>

        {/* Grid */}
        <div className="p-4">
          {leavesLoading ? (
            <div className="text-center py-10">
              <Icon name="ArrowPathIcon" size={22} className="animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm text-slate-500">Loading calendar…</p>
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {/* Empty leading cells */}
                {Array.from({ length: emptyCount }).map((_, i) => (
                  <div key={`e-${i}`} className="aspect-square bg-slate-50/50 rounded-lg" />
                ))}

                {/* Day cells */}
                {monthDays.map(date => {
                  const ds          = format(date, 'yyyy-MM-dd');
                  const dayLeaves   = leavesOnDate(date);
                  const dayHolidays = showHolidays ? (holidayMap.get(ds) || []) : [];
                  const isWeekendDay = isWeekend(date);
                  const inMonth     = isSameMonth(date, currentDate);
                  const isSelected  = selectedDate === ds;
                  const isDayToday  = isToday(date);

                  const hasMandatory = dayHolidays.some(h => h.holiday_type === 'mandatory');
                  const hasOptional  = dayHolidays.some(h => h.holiday_type === 'optional');

                  let cellBg = 'bg-white';
                  if (!inMonth)      cellBg = 'bg-slate-50/60';
                  else if (hasMandatory) cellBg = 'bg-amber-50';
                  else if (hasOptional)  cellBg = 'bg-sky-50/60';
                  else if (isWeekendDay) cellBg = 'bg-slate-50';

                  return (
                    <div
                      key={ds}
                      onClick={() => setSelectedDate(isSelected ? null : ds)}
                      className={`min-h-[72px] rounded-lg border-2 p-1 cursor-pointer transition-all ${cellBg} ${
                        isSelected
                          ? 'border-blue-500 shadow-sm'
                          : isDayToday
                          ? 'border-blue-400'
                          : hasMandatory
                          ? 'border-amber-200'
                          : hasOptional
                          ? 'border-sky-200'
                          : 'border-slate-100 hover:border-blue-200'
                      }`}
                    >
                      {/* Date number */}
                      <div className={`text-xs font-bold mb-0.5 ${
                        isDayToday
                          ? 'text-blue-600'
                          : !inMonth
                          ? 'text-slate-300'
                          : isWeekendDay
                          ? 'text-slate-400'
                          : 'text-slate-700'
                      }`}>
                        {format(date, 'd')}
                      </div>

                      {/* Holiday chips */}
                      {dayHolidays.slice(0, 1).map(h => (
                        <div key={h.id} className={`text-[9px] font-semibold px-1 py-0.5 rounded truncate mb-0.5 ${
                          h.holiday_type === 'mandatory'
                            ? 'bg-amber-200 text-amber-800'
                            : 'bg-sky-100 text-sky-700'
                        }`} title={h.name}>
                          {h.is_long_weekend ? '⭐ ' : '🌟 '}{h.name}
                        </div>
                      ))}

                      {/* Leave chips */}
                      {dayLeaves.slice(0, 2).map(l => (
                        <div
                          key={l.id}
                          className={`text-[9px] px-1 py-0.5 rounded truncate border ${
                            LEAVE_COLORS[l.leave_type] || DEFAULT_LEAVE_COLOR
                          }`}
                          title={l.employee_name}
                        >
                          {l.employee_name.split(' ')[0]}
                        </div>
                      ))}

                      {/* Overflow */}
                      {(dayLeaves.length + dayHolidays.length) > 3 && (
                        <div className="text-[9px] text-slate-400 px-1">
                          +{(dayLeaves.length + dayHolidays.length) - 3}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Selected date detail panel */}
        {selectedDate && (
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">
                {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
              </h3>
              <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600">
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>

            {/* Holidays on this day */}
            {(holidayMap.get(selectedDate) || []).length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1.5">Holidays</p>
                <div className="space-y-1.5">
                  {(holidayMap.get(selectedDate) || []).map(h => (
                    <div key={h.id} className={`flex items-center gap-3 text-sm p-2.5 rounded-lg border ${
                      h.holiday_type === 'mandatory'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-sky-50 border-sky-200'
                    }`}>
                      <Icon name="SunIcon" size={14} className={h.holiday_type === 'mandatory' ? 'text-amber-500' : 'text-sky-400'} />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{h.name}</p>
                        {h.description && <p className="text-xs text-slate-500">{h.description}</p>}
                        {h.is_long_weekend && (
                          <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                            ⭐ Long weekend —{' '}
                            {new Date(h.long_weekend_start!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {' to '}
                            {new Date(h.long_weekend_end!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {' '}({h.long_weekend_days} days off)
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        h.holiday_type === 'mandatory'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}>
                        {h.holiday_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaves on this day */}
            {leavesOnDate(parseISO(selectedDate)).length === 0 && (holidayMap.get(selectedDate) || []).length === 0 ? (
              <p className="text-sm text-slate-500">No leaves or holidays on this date</p>
            ) : leavesOnDate(parseISO(selectedDate)).length > 0 ? (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">On Leave</p>
                <div className="space-y-1.5">
                  {leavesOnDate(parseISO(selectedDate)).map(l => (
                    <div key={l.id} className="flex items-center gap-3 text-sm bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        (LEAVE_COLORS[l.leave_type] || DEFAULT_LEAVE_COLOR).split(' ')[0].replace('bg-', 'bg-')
                      }`} />
                      <div>
                        <p className="font-medium text-slate-800">{l.employee_name}</p>
                        <p className="text-xs text-slate-500">
                          {l.leave_type} · {format(parseISO(l.start_date), 'MMM d')} – {format(parseISO(l.end_date), 'MMM d')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
