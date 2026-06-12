'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import EmployeeDashboardView from '@/app/hr-dashboard/components/EmployeeDashboardView';
import TimeTrackingWidget from '@/components/time/TimeTrackingWidget';
import PlanUsageCard from '@/components/PlanUsageCard';
import InsightsWidget from '@/components/InsightsWidget';
import HrStatsWidget from '@/components/HrStatsWidget';
import ProfileCard from '@/components/ProfileCard';

export default function MyDashboardPage() {
  return (
    <AppLayout
      pageTitle="My Dashboard"
      breadcrumb="Overview"
      requiredPermission="view_dashboard"
    >
      <div className="space-y-6">
        <PlanUsageCard />
        <InsightsWidget />
        <HrStatsWidget />
        <ProfileCard />
        <TimeTrackingWidget />
        <EmployeeDashboardView />
      </div>
    </AppLayout>
  );
}
