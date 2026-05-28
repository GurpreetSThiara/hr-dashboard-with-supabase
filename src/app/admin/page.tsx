'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';
import { toast } from 'sonner';
import LeavePoliciestab from './components/LeavePoliciestab';
import CheckinCheckoutTab from './components/CheckinCheckoutTab';
import ReportingHierarchyTab from './components/ReportingHierarchyTab';

type TabType = 'policies' | 'checkin' | 'hierarchy';

export default function AdminPage() {
  const { user } = useAuth();
  const { tier, hasPermission } = useRoleBasedAccess();
  const [activeTab, setActiveTab] = useState<TabType>('policies');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only allow super admin (tier <= 2)
    if (!user || !hasPermission('admin_panel')) {
      toast.error('Access denied. Admin only.');
      window.location.href = '/hr-dashboard';
    }
    setLoading(false);
  }, [user, hasPermission]);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <AppLayout>
      <div className="flex-1">
        {/* Header */}
        <div className="border-b border-slate-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-slate-900">Admin Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage leave policies, check-in/out, and organizational hierarchy</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-0 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'policies'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Leave Policies
          </button>
          <button
            onClick={() => setActiveTab('checkin')}
            className={`px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'checkin'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Check-in/Out
          </button>
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'hierarchy'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Reporting Hierarchy
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {activeTab === 'policies' && <LeavePoliciestab />}
          {activeTab === 'checkin' && <CheckinCheckoutTab />}
          {activeTab === 'hierarchy' && <ReportingHierarchyTab />}
        </div>
      </div>
    </AppLayout>
  );
}
