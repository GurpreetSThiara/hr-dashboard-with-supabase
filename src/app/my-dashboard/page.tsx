'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import EmployeeDashboardView from '@/app/hr-dashboard/components/EmployeeDashboardView';

export default function MyDashboardPage() {
  return (
    <AppLayout 
      pageTitle="My Dashboard" 
      breadcrumb="Overview" 
      requiredPermission="view_dashboard"
    >
      <EmployeeDashboardView />
    </AppLayout>
  );
}
