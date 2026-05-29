'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardBentoGrid from './components/DashboardBentoGrid';
import DashboardChartsRow from './components/DashboardChartsRow';
import DashboardSidePanel from './components/DashboardSidePanel';
import DashboardComplianceBar from './components/DashboardComplianceBar';
import EmployeeDashboardView from './components/EmployeeDashboardView';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';

export default function HRDashboardPage() {
  const { hasPermission, loading } = useRoleBasedAccess() as any;

  const showHRDashboard = hasPermission('view_hr_dashboard');

  return (
    <AppLayout 
      pageTitle={showHRDashboard ? "HR Dashboard" : "My Dashboard"} 
      breadcrumb="Overview" 
      requiredPermission="view_dashboard"
    >
      {showHRDashboard ? (
        <>
          <DashboardComplianceBar />
          <DashboardBentoGrid />
          <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <DashboardChartsRow />
            </div>
            <div className="xl:col-span-1">
              <DashboardSidePanel />
            </div>
          </div>
        </>
      ) : (
        <EmployeeDashboardView />
      )}
    </AppLayout>
  );
}