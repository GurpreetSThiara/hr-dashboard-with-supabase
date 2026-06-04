'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface Dist { name: string; value: number; }
interface Overview {
  totalHeadcount: number; activeEmployees: number; terminated: number;
  newHires30: number; newHires90: number; attritionRatePct: number;
  departmentDistribution: Dist[]; locationDistribution: Dist[]; employmentTypeDistribution: Dist[];
}

const BAR_COLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-pink-500','bg-indigo-500','bg-teal-500','bg-rose-500','bg-cyan-500','bg-orange-500'];

function DistList({ title, data }: { title: string; data: Dist[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400">No data</p>
      ) : (
        <div className="space-y-2.5">
          {data.map((d, i) => (
            <div key={d.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">{d.name}</span>
                <span className="text-slate-400 font-mono">{d.value}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${(d.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/organization/overview')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-sm text-slate-500">Loading organization metrics…</p>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-red-600">Failed to load overview.</p>;

  const cards = [
    { label: 'Total Headcount', value: data.totalHeadcount, icon: 'UsersIcon', color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Employees', value: data.activeEmployees, icon: 'CheckCircleIcon', color: 'text-emerald-600 bg-emerald-50' },
    { label: 'New Hires (90d)', value: data.newHires90, icon: 'UserPlusIcon', color: 'text-violet-600 bg-violet-50' },
    { label: 'Attrition Rate', value: `${data.attritionRatePct}%`, icon: 'ArrowTrendingDownIcon', color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
              <Icon name={c.icon as any} size={20} />
            </div>
            <p className="text-3xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DistList title="Department Distribution" data={data.departmentDistribution} />
        <DistList title="Geographic Distribution" data={data.locationDistribution} />
        <DistList title="Employment Type" data={data.employmentTypeDistribution} />
      </div>
    </div>
  );
}
