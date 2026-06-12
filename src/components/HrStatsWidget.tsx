'use client';

/** Org-wide HR metrics: open positions, pending approvals, new hires, upcoming
 * interviews, open grievances, and a headcount-by-department mini chart. */
import React, { useEffect, useState } from 'react';

export default function HrStatsWidget() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch('/api/me/hr-stats').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, []);
  if (!d?.derived) return null;
  const x = d.derived;
  const dept: { department: string; n: number }[] = x.headcountByDept ?? [];
  const max = Math.max(1, ...dept.map(r => r.n));

  const stats = [
    ['Open positions', x.openPositions],
    ['Pending approvals', x.pendingApprovals],
    ['New hires (month)', x.newHires],
    ['Upcoming interviews', x.upcomingInterviews],
    ['Open grievances', x.openGrievances],
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">HR at a glance</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xl font-semibold text-slate-900">{v ?? 0}</p>
            <p className="text-xs text-slate-500">{l}</p>
          </div>
        ))}
      </div>
      {dept.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Headcount by department</p>
          <div className="space-y-1.5">
            {dept.map(r => (
              <div key={r.department} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 truncate text-slate-600">{r.department || '—'}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.n / max) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-slate-500">{r.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
