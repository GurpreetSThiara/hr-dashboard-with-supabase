'use client';

import React from 'react';
import HeadcountTrendChart from '@/app/hr-dashboard/components/HeadcountTrendChart';
import LeaveByDepartmentChart from '@/app/hr-dashboard/components/LeaveByDepartmentChart';

/**
 * Organization analytics — role-gated at the page level (view_hr_dashboard).
 * Reuses the real, API-backed chart components (headcount trend from
 * employees.join_date, leave-by-department from leave_requests).
 */
export default function OrgAnalytics() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HeadcountTrendChart />
        <LeaveByDepartmentChart />
      </div>
      <p className="text-xs text-slate-400">
        Analytics reflect live system data. Additional executive dashboards (productivity,
        performance, attrition trends) require the Performance module and historical
        snapshots, which are on the roadmap.
      </p>
    </div>
  );
}
