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

type TabType =
  | 'users' | 'permissions' | 'access-control' | 'standard-objects' | 'custom-objects'
  | 'policies' | 'holidays' | 'checkin' | 'attendance-settings' | 'hierarchy'
  | 'leave-permissions' | 'audit';

interface TabMeta { id: TabType; label: string; icon: string; description: string; }

const TABS: Record<TabType, TabMeta> = {
  'users':              { id: 'users',              label: 'Users',               icon: 'UsersIcon',                 description: 'Manage user accounts and role assignments' },
  'permissions':        { id: 'permissions',        label: 'Roles & Permissions', icon: 'ShieldCheckIcon',           description: 'Configure what each role can access' },
  'access-control':     { id: 'access-control',     label: 'Access Control',      icon: 'KeyIcon',                   description: 'Role groups and permission sets (additive, time-boxed grants)' },
  'leave-permissions':  { id: 'leave-permissions',  label: 'Leave Permissions',   icon: 'LockClosedIcon',            description: 'Configure visibility, approval authority, delegations, and audit log' },
  'hierarchy':          { id: 'hierarchy',          label: 'Org Hierarchy',       icon: 'BuildingOffice2Icon',       description: 'Manage reporting relationships' },
  'standard-objects':   { id: 'standard-objects',   label: 'Standard Objects',    icon: 'RectangleStackIcon',        description: 'System objects — toggle standard field visibility; add custom fields & relationships' },
  'custom-objects':     { id: 'custom-objects',     label: 'Custom Objects',      icon: 'CubeIcon',                  description: 'Define dynamic business objects and fields without code' },
  'policies':           { id: 'policies',           label: 'Leave Management',    icon: 'CalendarDaysIcon',          description: 'Manage leave types, policy versions, and all leave requests' },
  'holidays':           { id: 'holidays',           label: 'Holiday Management',  icon: 'SunIcon',                   description: 'Configure company holidays, optional holidays, and holiday policies' },
  'checkin':            { id: 'checkin',            label: 'Attendance Logs',     icon: 'ClockIcon',                 description: 'View employee check-in / check-out history' },
  'attendance-settings':{ id: 'attendance-settings',label: 'Attendance Settings', icon: 'Cog6ToothIcon',             description: 'Configure global attendance rules, allowed check-in roles, and regularization limits' },
  'audit':              { id: 'audit',              label: 'Audit Log',           icon: 'ClipboardDocumentListIcon', description: 'Immutable trail of every privileged administrative action' },
};

interface NavGroup { id: string; label: string; icon: string; tabs: TabType[]; }

// Information architecture — grouped by administrative domain (separation of concerns).
const GROUPS: NavGroup[] = [
  { id: 'data-model',  label: 'Data Model',             icon: 'CircleStackIcon',    tabs: ['standard-objects', 'custom-objects'] },
  { id: 'access',      label: 'User & Access',          icon: 'UserGroupIcon',      tabs: ['users', 'permissions', 'access-control', 'leave-permissions', 'hierarchy'] },
  { id: 'operations',  label: 'Leave & Attendance',     icon: 'CalendarDaysIcon',   tabs: ['policies', 'holidays', 'checkin', 'attendance-settings'] },
  { id: 'monitoring',  label: 'Monitoring & Operations', icon: 'ChartBarSquareIcon', tabs: ['audit'] },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);

  const active = TABS[activeTab];
  const activeGroup = GROUPS.find(g => g.tabs.includes(activeTab))!;

  function selectTab(id: TabType) {
    setActiveTab(id);
    setSheetOpen(false);
  }

  function toggleGroup(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <AppLayout pageTitle="Admin Management" breadcrumb="Admin" requiredPermission="admin_panel">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Page header (compact on mobile) */}
        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name="ShieldCheckIcon" size={20} className="text-purple-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">Admin Management</h1>
              <p className="hidden sm:block text-sm text-slate-500">Super Admin control panel — organized by administrative domain</p>
            </div>
          </div>
        </div>

        {/* Mobile section selector (sticky) — opens a bottom sheet */}
        <button
          onClick={() => setSheetOpen(true)}
          className="lg:hidden sticky top-0 z-20 w-full flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 text-left active:bg-slate-50"
        >
          <Icon name={active.icon as any} size={18} className="text-blue-600 flex-shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] text-slate-400 leading-none">{activeGroup.label}</span>
            <span className="block text-sm font-semibold text-slate-900 truncate">{active.label}</span>
          </span>
          <Icon name="ChevronUpDownIcon" size={18} className="text-slate-400 flex-shrink-0" />
        </button>

        {/* Body: grouped secondary nav + content */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Desktop grouped navigation (hidden on mobile — replaced by the bottom sheet) */}
          <nav
            aria-label="Admin sections"
            className="hidden lg:block w-64 lg:shrink-0 border-r border-slate-200 bg-slate-50/60 overflow-y-auto p-3 space-y-1"
          >
            {GROUPS.map(group => {
              const isCollapsed = collapsed.has(group.id);
              const groupActive = group.tabs.includes(activeTab);
              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={!isCollapsed}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                      groupActive ? 'text-purple-700' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon name={group.icon as any} size={14} className="flex-shrink-0" />
                    <span className="flex-1 text-left">{group.label}</span>
                    <Icon name={isCollapsed ? 'ChevronRightIcon' : 'ChevronDownIcon'} size={13} className="flex-shrink-0 text-slate-400" />
                  </button>

                  {!isCollapsed && (
                    <div className="mt-0.5 mb-1 space-y-0.5">
                      {group.tabs.map(tabId => {
                        const tab = TABS[tabId];
                        const isActive = activeTab === tabId;
                        return (
                          <button
                            key={tabId}
                            onClick={() => setActiveTab(tabId)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`w-full flex items-center gap-2.5 pl-7 pr-2.5 py-2 rounded-lg text-sm transition-colors ${
                              isActive
                                ? 'bg-white text-blue-700 font-semibold shadow-sm border border-slate-200'
                                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                            }`}
                          >
                            <Icon name={tab.icon as any} size={15} className="flex-shrink-0" />
                            <span className="truncate">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Content */}
          <div className={`flex-1 overflow-auto ${activeTab === 'permissions' ? 'p-4 sm:p-6 flex flex-col' : 'p-4 sm:p-6 lg:p-8'}`}>
            {/* Breadcrumb + description */}
            <div className="mb-5">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <span>{activeGroup.label}</span>
                <Icon name="ChevronRightIcon" size={12} />
                <span className="text-slate-600 font-medium">{active.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name={active.icon as any} size={18} className="text-slate-500" />
                <p className="text-sm text-slate-500">{active.description}</p>
              </div>
            </div>

            {activeTab === 'users'               && <UsersTab />}
            {activeTab === 'permissions'         && <PermissionsMatrixTab />}
            {activeTab === 'policies'            && <LeaveManagementTab />}
            {activeTab === 'checkin'             && <CheckinCheckoutTab />}
            {activeTab === 'hierarchy'           && <ReportingHierarchyTab />}
            {activeTab === 'attendance-settings' && <AttendanceSettingsTab />}
            {activeTab === 'leave-permissions'   && <LeavePermissionsTab />}
            {activeTab === 'holidays'            && <HolidaysTab />}
            {activeTab === 'audit'               && <AdminAuditTab />}
            {activeTab === 'access-control'      && <AccessControlTab />}
            {activeTab === 'standard-objects'    && <StandardObjectsTab />}
            {activeTab === 'custom-objects'      && <CustomObjectsTab />}
          </div>
        </div>
      </div>

      {/* Mobile bottom-sheet navigation */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin sections"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] flex flex-col bg-white rounded-t-2xl shadow-2xl
                       pb-[env(safe-area-inset-bottom)] animate-fade-in"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
              <h2 className="text-sm font-bold text-slate-900">Admin Sections</h2>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="mx-auto w-10 h-1 rounded-full bg-slate-200 mb-2 -mt-1" />
            <div className="overflow-y-auto px-3 pb-4 space-y-4">
              {GROUPS.map(group => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 px-2 pb-1.5">
                    <Icon name={group.icon as any} size={13} className="text-slate-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{group.label}</span>
                  </div>
                  <div className="space-y-1">
                    {group.tabs.map(tabId => {
                      const tab = TABS[tabId];
                      const isActive = activeTab === tabId;
                      return (
                        <button
                          key={tabId}
                          onClick={() => selectTab(tabId)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full flex items-center gap-3 px-3 min-h-[48px] rounded-xl text-left transition-colors ${
                            isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 active:bg-slate-100'
                          }`}
                        >
                          <Icon name={tab.icon as any} size={18} className="flex-shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold truncate">{tab.label}</span>
                            <span className="block text-[11px] text-slate-400 truncate">{tab.description}</span>
                          </span>
                          {isActive && <Icon name="CheckIcon" size={16} className="text-blue-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
