'use client';

import React, { useState } from 'react';
import HeadcountTrendChart from './HeadcountTrendChart';
import LeaveByDepartmentChart from './LeaveByDepartmentChart';

export default function DashboardChartsRow() {
  const [activeChart, setActiveChart] = useState<'headcount' | 'leave'>('headcount');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <HeadcountTrendChart />
      <LeaveByDepartmentChart />
    </div>
  );
}