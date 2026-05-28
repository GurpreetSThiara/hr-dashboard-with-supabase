'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import LeaveAttendanceSection from './components/LeaveAttendanceSection';
import LeaveCalendarView from './components/LeaveCalendarView';

export default function LeaveAttendancePage() {
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

  return (
    <AppLayout pageTitle="Leave & Attendance" breadcrumb="Leave Management" requiredPermission="view_leaves">
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-0 border-b border-slate-200 bg-white rounded-t-lg">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-6 py-4 font-medium border-b-2 transition ${
              activeTab === 'calendar'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Calendar View
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'list' && <LeaveAttendanceSection />}
        {activeTab === 'calendar' && <LeaveCalendarView />}
      </div>
    </AppLayout>
  );
}
