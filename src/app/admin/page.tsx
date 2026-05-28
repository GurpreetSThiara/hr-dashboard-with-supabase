'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import LeaveManagementTab from './components/LeaveManagementTab';
import CheckinCheckoutTab from './components/CheckinCheckoutTab';
import ReportingHierarchyTab from './components/ReportingHierarchyTab';
import PermissionsMatrixTab from './components/PermissionsMatrixTab';
import UsersTab from './components/UsersTab';

type TabType = 'users' | 'permissions' | 'policies' | 'checkin' | 'hierarchy';

const TABS: { id: TabType; label: string; icon: string; description: string }[] = [
  { id: 'users',       label: 'Users',              icon: 'UsersIcon',             description: 'Manage user accounts and role assignments' },
  { id: 'permissions', label: 'Roles & Permissions', icon: 'ShieldCheckIcon',       description: 'Configure what each role can access' },
  { id: 'policies',    label: 'Leave Management',    icon: 'CalendarDaysIcon',      description: 'Manage leave types, policy versions, and all leave requests' },
  { id: 'checkin',     label: 'Attendance Logs',     icon: 'ClockIcon',             description: 'View employee check-in / check-out history' },
  { id: 'hierarchy',   label: 'Org Hierarchy',       icon: 'BuildingOffice2Icon',   description: 'Manage reporting relationships' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const active = TABS.find(t => t.id === activeTab)!;

  return (
    <AppLayout pageTitle="Admin Management" breadcrumb="Admin" requiredPermission="admin_panel">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Page header */}
        <div className="px-8 py-6 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Icon name="ShieldCheckIcon" size={22} className="text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin Management</h1>
              <p className="text-sm text-slate-500">Super Admin control panel — manage users, roles, policies and system settings</p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-0 border-b border-slate-200 bg-white px-8 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon name={tab.icon as any} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={`flex-1 overflow-auto ${activeTab === 'permissions' ? 'p-6 flex flex-col' : 'p-8'}`}>
          {/* Tab subtitle */}
          <div className="mb-5 flex items-center gap-2">
            <Icon name={active.icon as any} size={18} className="text-slate-500" />
            <p className="text-sm text-slate-500">{active.description}</p>
          </div>

          {activeTab === 'users'       && <UsersTab />}
          {activeTab === 'permissions' && <PermissionsMatrixTab />}
          {activeTab === 'policies'    && <LeaveManagementTab />}
          {activeTab === 'checkin'     && <CheckinCheckoutTab />}
          {activeTab === 'hierarchy'   && <ReportingHierarchyTab />}
        </div>
      </div>
    </AppLayout>
  );
}
