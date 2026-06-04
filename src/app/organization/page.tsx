'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';
import OrgOverview from './components/OrgOverview';
import OrgChart from './components/OrgChart';
import OrgPolicies from './components/OrgPolicies';
import OrgAnalytics from './components/OrgAnalytics';

type TabType = 'overview' | 'structure' | 'policies' | 'analytics';

export default function OrganizationPage() {
  const { hasPermission } = useRoleBasedAccess();
  const canViewAnalytics = hasPermission('view_hr_dashboard');
  const [tab, setTab] = useState<TabType>('overview');

  const TABS: { id: TabType; label: string; icon: string; show: boolean }[] = [
    { id: 'overview',  label: 'Overview',   icon: 'BuildingOffice2Icon', show: true },
    { id: 'structure', label: 'Structure',  icon: 'ShareIcon',           show: true },
    { id: 'policies',  label: 'Policies',   icon: 'DocumentTextIcon',    show: true },
    { id: 'analytics', label: 'Analytics',  icon: 'ChartBarSquareIcon',  show: canViewAnalytics },
  ];

  return (
    <AppLayout pageTitle="Organization" breadcrumb="Company" requiredPermission="view_dashboard">
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.filter((t) => t.show).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon name={t.icon as any} size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'  && <OrgOverview />}
      {tab === 'structure' && <OrgChart />}
      {tab === 'policies'  && <OrgPolicies />}
      {tab === 'analytics' && canViewAnalytics && <OrgAnalytics />}
    </AppLayout>
  );
}
