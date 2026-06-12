'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import EmployeeSummaryCards from './components/EmployeeSummaryCards';
import EmployeeTableSection from './components/EmployeeTableSection';
import TeamView from './components/TeamView';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';

type TabType = 'my-team' | 'all-employees';

export default function TeamPage() {
  const { hasPermission } = useRoleBasedAccess();
  // Only HR / managers with employee-management rights see the admin table tab.
  const canManage = hasPermission('manage_employees');
  const [activeTab, setActiveTab] = useState<TabType>('my-team');

  return (
    <AppLayout pageTitle="Team" breadcrumb="People" requiredPermission="view_employees" requiredModule="employees">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('my-team')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === 'my-team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Icon name="UserGroupIcon" size={16} /> My Team
        </button>
        {canManage && (
          <button
            onClick={() => setActiveTab('all-employees')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'all-employees' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon name="UsersIcon" size={16} /> All Employees
          </button>
        )}
      </div>

      {activeTab === 'my-team' && <TeamView />}

      {activeTab === 'all-employees' && canManage && (
        <>
          <EmployeeSummaryCards />
          <div className="mt-6">
            <EmployeeTableSection />
          </div>
        </>
      )}
    </AppLayout>
  );
}
