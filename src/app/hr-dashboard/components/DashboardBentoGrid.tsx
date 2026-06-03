'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export default function DashboardBentoGrid() {
  const [metrics, setMetrics] = useState({
    totalHeadcount: 0,
    activeEmployees: 0,
    onLeave: 0,
    onboarding: 0,
    pendingLeaves: 0,
    attendanceToday: 0,
    presentToday: 0,
  });

  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const [
        { data: employees },
        { data: leaveRequests },
        { data: attendance },
      ] = await Promise.all([
        supabase.from('employees').select('status'),
        supabase.from('leave_requests').select('id').eq('status', 'pending'),
        supabase.from('attendance_records').select('status').eq('attendance_date', new Date().toISOString().split('T')[0]),
      ]);

      const totalHeadcount = employees?.length || 0;
      const activeEmployees = employees?.filter((e: any) => e.status === 'active').length || 0;
      const onLeave = employees?.filter((e: any) => e.status === 'onleave').length || 0;
      const onboarding = employees?.filter((e: any) => e.status === 'onboarding').length || 0;
      const presentToday = attendance?.filter((a: any) => a.status === 'present').length || 0;
      const attendanceToday = totalHeadcount > 0 ? ((presentToday / totalHeadcount) * 100).toFixed(1) : '0';

      setMetrics({
        totalHeadcount,
        activeEmployees,
        onLeave,
        onboarding,
        pendingLeaves: leaveRequests?.length || 0,
        attendanceToday: parseFloat(attendanceToday),
        presentToday,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ── Realtime: re-fetch metrics on any relevant change ──────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('bento_metrics_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchMetrics())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => fetchMetrics())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => fetchMetrics())
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      setIsLive(false);
    };
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">

      {/* Hero: Headcount — spans 2 cols */}
      <div className="sm:col-span-2 lg:col-span-2 metric-card border border-slate-200 rounded-xl p-5 bg-white hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center">
            <Icon name="UsersIcon" size={22} className="text-blue-700" />
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1 text-[10px] font-semibold ${isLive ? 'text-emerald-600' : 'text-slate-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              {isLive ? 'Live' : '—'}
            </span>
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Headcount</p>
        <p className="text-4xl font-bold text-slate-900 font-mono-data">{metrics.totalHeadcount}</p>
        <p className="text-xs text-slate-500 mt-1">Across departments and locations</p>
        <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 font-mono-data">{metrics.activeEmployees}</p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <div className="text-center border-x border-slate-100">
            <p className="text-lg font-bold text-amber-600 font-mono-data">{metrics.onLeave}</p>
            <p className="text-xs text-slate-500">On Leave</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-blue-600 font-mono-data">{metrics.onboarding}</p>
            <p className="text-xs text-slate-500">Onboarding</p>
          </div>
        </div>
      </div>

      {/* Pending Leave Approvals — alert state */}
      <div className="metric-card border border-amber-200 rounded-xl p-5 bg-amber-50 hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Icon name="ClockIcon" size={20} className="text-amber-600" />
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Action Needed
          </span>
        </div>
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Pending Leaves</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data">{metrics.pendingLeaves}</p>
        <p className="text-xs text-amber-700 mt-1">Awaiting approval</p>
        <Link href="/leave-attendance" className="mt-3 text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors">
          Review all <Icon name="ArrowRightIcon" size={11} />
        </Link>
      </div>

      {/* Attendance Today */}
      <div className="metric-card border border-slate-200 rounded-xl p-5 bg-white hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Icon name="CheckCircleIcon" size={20} className="text-emerald-600" />
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Attendance Today</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data">{Number(metrics.attendanceToday).toFixed(1)}%</p>
        <p className="text-xs text-slate-500 mt-1">{metrics.presentToday} of {metrics.totalHeadcount} present</p>
        <div className="mt-3 w-full bg-slate-200 rounded-full h-1.5">
          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${metrics.attendanceToday}%` }} />
        </div>
      </div>

    </div>
  );
}
