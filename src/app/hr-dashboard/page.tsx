import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardBentoGrid from './components/DashboardBentoGrid';
import DashboardChartsRow from './components/DashboardChartsRow';
import DashboardSidePanel from './components/DashboardSidePanel';
import DashboardComplianceBar from './components/DashboardComplianceBar';

export default function HRDashboardPage() {
  return (
    <AppLayout pageTitle="HR Dashboard" breadcrumb="Overview">
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
    </AppLayout>
  );
}