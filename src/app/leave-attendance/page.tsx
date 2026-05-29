'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import LeaveAttendanceSection from './components/LeaveAttendanceSection';
import LeaveCalendarView from './components/LeaveCalendarView';
import AttendanceTrackerTab from './components/AttendanceTrackerTab';
import RegularizationsTab from './components/RegularizationsTab';

type TabType = 'leave-requests' | 'leave-calendar' | 'attendance' | 'regularizations';

export default function LeaveAttendancePage() {
  const [activeTab, setActiveTab] = useState<TabType>('leave-requests');
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  const handleSwitchTab = (tab: TabType, date?: string) => {
    if (date) {
      setPrefillDate(date);
    }
    setActiveTab(tab);
  };

  return (
    <AppLayout pageTitle="Leave & Attendance" breadcrumb="Leave Management" requiredPermission="view_leaves">
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-0 border-b border-slate-200 bg-white rounded-t-lg scrollbar-none">
          <button
            onClick={() => setActiveTab('leave-requests')}
            className={`px-6 py-4 font-medium border-b-2 whitespace-nowrap transition ${
              activeTab === 'leave-requests'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveTab('leave-calendar')}
            className={`px-6 py-4 font-medium border-b-2 whitespace-nowrap transition ${
              activeTab === 'leave-calendar'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Leave Calendar
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-6 py-4 font-medium border-b-2 whitespace-nowrap transition ${
              activeTab === 'attendance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            My Attendance
          </button>
          <button
            onClick={() => setActiveTab('regularizations')}
            className={`px-6 py-4 font-medium border-b-2 whitespace-nowrap transition ${
              activeTab === 'regularizations'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Regularizations
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'leave-requests' && <LeaveAttendanceSection />}
        {activeTab === 'leave-calendar' && <LeaveCalendarView />}
        {activeTab === 'attendance' && (
          <AttendanceTrackerTab onSwitchTab={handleSwitchTab} />
        )}
        {activeTab === 'regularizations' && (
          <RegularizationsTab 
            prefillDate={prefillDate} 
            onClearPrefillDate={() => setPrefillDate(null)} 
          />
        )}
      </div>
    </AppLayout>
  );
}

