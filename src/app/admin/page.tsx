'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import LeaveManagementTab from './components/LeaveManagementTab';
import CheckinCheckoutTab from './components/CheckinCheckoutTab';
import ReportingHierarchyTab from './components/ReportingHierarchyTab';
import PermissionsMatrixTab from './components/PermissionsMatrixTab';
import UsersTab from './components/UsersTab';
import AttendanceSettingsTab from './components/AttendanceSettingsTab';
import LeavePermissionsTab from './components/LeavePermissionsTab';
import HolidaysTab from './components/HolidaysTab';
import AdminAuditTab from './components/AdminAuditTab';
import AccessControlTab from './components/AccessControlTab';
import CustomObjectsTab from './components/CustomObjectsTab';
import StandardObjectsTab from './components/StandardObjectsTab';

type TabType = 'users' | 'permissions' | 'access-control' | 'standard-objects' | 'custom-objects' | 'policies' | 'holidays' | 'checkin' | 'attendance-settings' | 'hierarchy' | 'leave-permissions' | 'audit';

const TABS: { id: TabType; label: string; icon: string; description: string }[] = [
  { id: 'users',             label: 'Users',              icon: 'UsersIcon',             description: 'Manage user accounts and role assignments' },
  { id: 'permissions',       label: 'Roles & Permissions', icon: 'ShieldCheckIcon',      description: 'Configure what each role can access' },
  { id: 'access-control',    label: 'Access Control',      icon: 'KeyIcon',              description: 'Role groups and permission sets (additive, time-boxed grants)' },
  { id: 'standard-objects',  label: 'Standard Objects',    icon: 'RectangleStackIcon',   description: 'System objects — toggle standard field visibility; add custom fields & relationships' },
  { id: 'custom-objects',    label: 'Custom Objects',      icon: 'CubeIcon',             description: 'Define dynamic business objects and fields without code' },
  { id: 'policies',          label: 'Leave Management',    icon: 'CalendarDaysIcon',     description: 'Manage leave types, policy versions, and all leave requests' },
  { id: 'holidays',          label: 'Holiday Management',  icon: 'SunIcon',              description: 'Configure company holidays, optional holidays, and holiday policies' },
  { id: 'leave-permissions', label: 'Leave Permissions',   icon: 'LockClosedIcon',       description: 'Configure visibility, approval authority, delegations, and audit log' },
  { id: 'checkin',           label: 'Attendance Logs',     icon: 'ClockIcon',            description: 'View employee check-in / check-out history' },
  { id: 'attendance-settings', label: 'Attendance Settings', icon: 'Cog6ToothIcon',     description: 'Configure global attendance rules, allowed check-in roles, and regularization limits' },
  { id: 'hierarchy',         label: 'Org Hierarchy',       icon: 'BuildingOffice2Icon',  description: 'Manage reporting relationships' },
  { id: 'audit',             label: 'Audit Log',           icon: 'ClipboardDocumentListIcon', description: 'Immutable trail of every privileged administrative action' },
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
          {activeTab === 'hierarchy'          && <ReportingHierarchyTab />}
          {activeTab === 'attendance-settings' && <AttendanceSettingsTab />}
          {activeTab === 'leave-permissions'   && <LeavePermissionsTab />}
          {activeTab === 'holidays'            && <HolidaysTab />}
          {activeTab === 'audit'               && <AdminAuditTab />}
          {activeTab === 'access-control'      && <AccessControlTab />}
          {activeTab === 'standard-objects'    && <StandardObjectsTab />}
          {activeTab === 'custom-objects'      && <CustomObjectsTab />}
        </div>
      </div>
    </AppLayout>
  );
}
