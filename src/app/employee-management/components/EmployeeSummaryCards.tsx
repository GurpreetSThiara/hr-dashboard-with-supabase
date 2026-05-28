'use client';

import React, { useEffect, useState } from 'react';
import MetricCard from '@/components/ui/MetricCard';
import { createClient } from '@/lib/supabase/client';

export default function EmployeeSummaryCards() {
  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    onLeaveCount: 0,
    onboardingCount: 0,
    terminatedCount: 0,
    newThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const { data: employees, error } = await supabase
          .from('employees')
          .select('status, join_date');

        if (error) throw error;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const totalEmployees = employees?.length || 0;
        const activeEmployees = employees?.filter((e: any) => e.status === 'active').length || 0;
        const onLeaveCount = employees?.filter((e: any) => e.status === 'onleave').length || 0;
        const onboardingCount = employees?.filter((e: any) => e.status === 'onboarding').length || 0;
        const terminatedCount = employees?.filter((e: any) => e.status === 'terminated').length || 0;
        const newThisMonth = employees?.filter((e: any) => e.join_date >= startOfMonth).length || 0;

        setMetrics({ totalEmployees, activeEmployees, onLeaveCount, onboardingCount, terminatedCount, newThisMonth });
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  const activeRate = metrics.totalEmployees > 0
    ? ((metrics.activeEmployees / metrics.totalEmployees) * 100).toFixed(1)
    : '0';
  const leaveRate = metrics.totalEmployees > 0
    ? ((metrics.onLeaveCount / metrics.totalEmployees) * 100).toFixed(1)
    : '0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <MetricCard
        label="Total Employees"
        value={metrics.totalEmployees.toString()}
        subValue="Across all departments"
        icon="UsersIcon"
        iconColor="text-blue-600"
        iconBg="bg-blue-100"
        trend={{ value: metrics.newThisMonth > 0 ? `+${metrics.newThisMonth} this month` : 'No new hires', direction: metrics.newThisMonth > 0 ? 'up' : 'neutral' }}
      />
      <MetricCard
        label="Active"
        value={metrics.activeEmployees.toString()}
        subValue="Currently working"
        icon="CheckCircleIcon"
        iconColor="text-emerald-600"
        iconBg="bg-emerald-100"
        variant="success"
        trend={{ value: `${activeRate}% of workforce`, direction: 'neutral' }}
      />
      <MetricCard
        label="On Leave"
        value={metrics.onLeaveCount.toString()}
        subValue="Approved absences"
        icon="CalendarDaysIcon"
        iconColor="text-amber-600"
        iconBg="bg-amber-100"
        variant="warning"
        trend={{ value: `${leaveRate}% of workforce`, direction: 'neutral' }}
      />
      <MetricCard
        label="Onboarding"
        value={metrics.onboardingCount.toString()}
        subValue="New joiners in progress"
        icon="ClipboardDocumentCheckIcon"
        iconColor="text-blue-600"
        iconBg="bg-blue-100"
        variant="info"
        trend={{ value: metrics.onboardingCount > 0 ? 'In progress' : 'None active', direction: 'neutral' }}
      />
      <MetricCard
        label="Terminated"
        value={metrics.terminatedCount.toString()}
        subValue="Left the organisation"
        icon="UserMinusIcon"
        iconColor="text-red-500"
        iconBg="bg-red-100"
        variant="alert"
        trend={{
          value: metrics.totalEmployees > 0
            ? `${((metrics.terminatedCount / metrics.totalEmployees) * 100).toFixed(1)}% attrition`
            : '0% attrition',
          direction: 'neutral',
        }}
      />
    </div>
  );
}
