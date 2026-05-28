'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,  } from 'recharts';

// Backend integration point: GET /api/analytics/leave-by-department?month=current
const LEAVE_DATA = [
  { dept: 'Engineering', approved: 18, pending: 6, rejected: 2 },
  { dept: 'Sales', approved: 12, pending: 8, rejected: 1 },
  { dept: 'Finance', approved: 7, pending: 3, rejected: 0 },
  { dept: 'Marketing', approved: 9, pending: 4, rejected: 1 },
  { dept: 'HR', approved: 4, pending: 2, rejected: 0 },
  { dept: 'Operations', approved: 14, pending: 5, rejected: 2 },
  { dept: 'Legal', approved: 3, pending: 1, rejected: 0 },
  { dept: 'IT', approved: 6, pending: 2, rejected: 1 },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-dropdown p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={`ttrow-${i}`} className="flex items-center gap-3 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500 capitalize">{p.name}</span>
          <span className="font-bold text-slate-900 ml-auto font-mono-data">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function LeaveByDepartmentChart() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Leave by Department</h3>
          <p className="text-xs text-slate-500 mt-0.5">April 2026 — approved, pending, rejected</p>
        </div>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors flex items-center gap-1">
          Full Report
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={LEAVE_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={8} barGap={2}>
          <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="dept"
            tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Sans' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Sans' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="approved" name="approved" fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="pending" name="pending" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="rejected" name="rejected" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        {[
          { color: '#10b981', label: 'Approved' },
          { color: '#f59e0b', label: 'Pending' },
          { color: '#ef4444', label: 'Rejected' },
        ].map((item) => (
          <div key={`legend-${item.label}`} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}