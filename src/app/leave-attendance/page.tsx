'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import LeaveAttendanceSection from './components/LeaveAttendanceSection';
import LeaveCalendarView from './components/LeaveCalendarView';
import AttendanceTrackerTab from './components/AttendanceTrackerTab';
import RegularizationsTab from './components/RegularizationsTab';
import ApplyLeaveModal from '@/components/ApplyLeaveModal';
import Icon from '@/components/ui/AppIcon';

type TabType = 'leave-requests' | 'leave-calendar' | 'attendance' | 'regularizations';

export default function LeaveAttendancePage() {
  const [activeTab, setActiveTab] = useState<TabType>('leave-requests');
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSwitchTab = (tab: TabType, date?: string) => {
    if (date) setPrefillDate(date);
    setActiveTab(tab);
  };

  function handleApplySuccess() {
    setRefreshKey(k => k + 1);
    setActiveTab('leave-requests');
  }

  return (
    <AppLayout pageTitle="Leave & Attendance" breadcrumb="Leave Management" requiredPermission="view_leaves">
      <div className="space-y-6">
        {/* Tab Navigation + Apply Leave CTA */}
        <div className="flex overflow-x-auto items-center justify-between border-b border-slate-200 bg-white rounded-t-lg scrollbar-none pr-4">
          <div className="flex gap-0">
            {([
              { id: 'leave-requests', label: 'Leave Requests' },
              { id: 'leave-calendar', label: 'Leave Calendar' },
              { id: 'attendance',     label: 'My Attendance' },
              { id: 'regularizations',label: 'Regularizations' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-6 py-4 font-medium border-b-2 whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Apply Leave CTA ───────────────────────────────────────────── */}
          <button
            onClick={() => setApplyModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition shrink-0"
          >
            <Icon name="PlusIcon" size={15} />
            Apply Leave
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'leave-requests'  && <LeaveAttendanceSection key={refreshKey} />}
        {activeTab === 'leave-calendar'  && <LeaveCalendarView />}
        {activeTab === 'attendance'      && <AttendanceTrackerTab onSwitchTab={handleSwitchTab} />}
        {activeTab === 'regularizations' && (
          <RegularizationsTab
            prefillDate={prefillDate}
            onClearPrefillDate={() => setPrefillDate(null)}
          />
        )}

        {/* Apply Leave Modal */}
        <ApplyLeaveModal
          open={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
          onSuccess={handleApplySuccess}
          prefillDate={prefillDate || undefined}
        />
      </div>
    </AppLayout>
  );
}

