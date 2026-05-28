'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export default function DashboardBentoGrid() {
  const [metrics, setMetrics] = useState({
    totalHeadcount: 0,
    activeEmployees: 0,
    onLeave: 0,
    onboarding: 0,
    pendingLeaves: 0,
    attendanceToday: 0,
    // TODO: Add payroll, attrition, requisitions, onboarding rate, policy acknowledgement when features are implemented
    // payrollPercent: 78,
    // attritionRate: 3.4,
    // openRequisitions: 38,
    // onboardingRate: 73.7,
    // policyAckRate: 98.2,
  });

  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const [
          { data: employees },
          { data: leaveRequests },
          { data: attendance },
        ] = await Promise.all([
          supabase.from('employees').select('*'),
          supabase.from('leave_requests').select('*').eq('status', 'pending'),
          supabase.from('attendance_records').select('*').eq('attendance_date', new Date().toISOString().split('T')[0]),
        ]);

        const totalHeadcount = employees?.length || 0;
        const activeEmployees = employees?.filter((e: any) => e.status === 'active').length || 0;
        const onLeave = employees?.filter((e: any) => e.status === 'onleave').length || 0;
        const onboarding = employees?.filter((e: any) => e.status === 'onboarding').length || 0;
        const presentToday = attendance?.filter((a: any) => a.status === 'present').length || 0;
        const attendanceToday = totalHeadcount > 0 ? ((presentToday / totalHeadcount) * 100).toFixed(1) : 0;

        setMetrics({
          totalHeadcount,
          activeEmployees,
          onLeave,
          onboarding,
          pendingLeaves: leaveRequests?.length || 0,
          attendanceToday: parseFloat(attendanceToday),
          // payrollPercent, attritionRate, openRequisitions, onboardingRate, policyAckRate will be added when features are implemented
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

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
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <Icon name="ArrowUpIcon" size={12} />
            +4.2% vs last month
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
        <button className="mt-3 text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors">
          Review all <Icon name="ArrowRightIcon" size={11} />
        </button>
      </div>

      {/* Attendance Today */}
      <div className="metric-card border border-slate-200 rounded-xl p-5 bg-white hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Icon name="CheckCircleIcon" size={20} className="text-emerald-600" />
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-red-500">
            <Icon name="ArrowDownIcon" size={12} />
            -1.2%
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Attendance Today</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data">{metrics.attendanceToday.toFixed(1)}%</p>
        <p className="text-xs text-slate-500 mt-1">{metrics.activeEmployees} of {metrics.totalHeadcount} present</p>
        <div className="mt-3 w-full bg-slate-200 rounded-full h-1.5">
          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${metrics.attendanceToday}%` }} />
        </div>
      </div>

      {/* COMMENTED OUT - Payroll Cycle (Feature not implemented yet)
      <div className="metric-card border border-slate-200 rounded-xl p-5 bg-white hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Icon name="BanknotesIcon" size={20} className="text-blue-600" />
          </div>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Processing
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Payroll Cycle</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data">{metrics.payrollPercent}%</p>
        <p className="text-xs text-slate-500 mt-1">Apr 2026 — 7 days remaining</p>
        <div className="mt-3 w-full bg-slate-200 rounded-full h-1.5">
          <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${metrics.payrollPercent}%` }} />
        </div>
      </div> */}

      {/* COMMENTED OUT - Attrition Rate (Feature not implemented yet)
      <div className="metric-card border border-red-200 rounded-xl p-5 bg-red-50 hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Icon name="ArrowTrendingDownIcon" size={20} className="text-red-500" />
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-red-600">
            <Icon name="ArrowUpIcon" size={12} />
            +0.8%
          </div>
        </div>
        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Attrition (MTD)</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data">{metrics.attritionRate}%</p>
        <p className="text-xs text-red-600 mt-1">14 resignations this month</p>
      </div> */}

      {/* COMMENTED OUT - Open Requisitions (Feature not implemented yet)
      <div className="metric-card border border-slate-200 rounded-xl p-5 bg-white hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
            <Icon name="BriefcaseIcon" size={20} className="text-violet-600" />
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <Icon name="ArrowUpIcon" size={12} />
            +3 this week
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Open Requisitions</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data">{metrics.openRequisitions}</p>
        <p className="text-xs text-slate-500 mt-1">12 in final interview stage</p>
      </div> */}

      {/* COMMENTED OUT - Onboarding Completion (Feature not implemented yet)
      <div className="metric-card border border-slate-200 rounded-xl p-5 bg-white hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
            <Icon name="ClipboardDocumentCheckIcon" size={20} className="text-sky-600" />
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
            <Icon name="ArrowDownIcon" size={12} />
            -5.1%
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Onboarding Rate</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data">{metrics.onboardingRate}%</p>
        <p className="text-xs text-slate-500 mt-1">{Math.ceil((metrics.onboardingRate / 100) * metrics.onboarding)} of {metrics.onboarding} joiners completed</p>
        <div className="mt-3 w-full bg-slate-200 rounded-full h-1.5">
          <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${metrics.onboardingRate}%` }} />
        </div>
      </div> */}

      {/* COMMENTED OUT - Policy Acknowledgement (Feature not implemented yet)
      <div className="metric-card border border-slate-200 rounded-xl p-5 bg-white hover:shadow-card-hover transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Icon name="DocumentCheckIcon" size={20} className="text-indigo-600" />
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
            <Icon name="ArrowDownIcon" size={12} />
            23 pending
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Policy Ack. Rate</p>
        <p className="text-2xl font-bold text-slate-900 font-mono-data">{metrics.policyAckRate}%</p>
        <p className="text-xs text-slate-500 mt-1">IT Security Policy — Apr 2026</p>
        <div className="mt-3 w-full bg-slate-200 rounded-full h-1.5">
          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${metrics.policyAckRate}%` }} />
        </div>
      </div> */}

    </div>
  );
}
