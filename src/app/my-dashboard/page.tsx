'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import EmployeeDashboardView from '@/app/hr-dashboard/components/EmployeeDashboardView';
import TimeTrackingWidget from '@/components/time/TimeTrackingWidget';

export default function MyDashboardPage() {
  return (
    <AppLayout
      pageTitle="My Dashboard"
      breadcrumb="Overview"
      requiredPermission="view_dashboard"
    >
      <div className="space-y-6">
        <TimeTrackingWidget />
        <EmployeeDashboardView />
      </div>
    </AppLayout>
  );
}
