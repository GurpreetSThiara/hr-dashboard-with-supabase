'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { Card, StatCard, Badge, PageHeader, Loading, ErrorBanner } from '@/components/ui';
import Icon from '@/components/Icon';

interface Overview {
  organizations: { total: number; byStatus: Record<string, number> };
  users: { tenant_users: number; super_owners: number };
  activeSubscriptions: number;
  modules: number;
  planDistribution: { code: string; name: string; n: number }[];
  recentOrganizations: { id: string; name: string; slug: string; status: string; plan_name: string | null; user_count: number; created_at: string }[];
  growth: { label: string; n: number }[];
  mrr: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Overview>('/api/overview').then(setData).catch(e => setError(e.message));
  }, []);

  const maxPlan = data ? Math.max(1, ...data.planDistribution.map(p => p.n)) : 1;

  return (
    <Shell>
      <PageHeader title="Platform Overview" subtitle="Health and activity across all organizations." />
      <ErrorBanner message={error} />

      {!data && !error ? <Loading /> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Organizations" value={data.organizations.total}
              hint={`${data.organizations.byStatus.active ?? 0} active`} accent="brand" />
            <StatCard label="Est. MRR" value={`$${data.mrr.toLocaleString()}`}
              hint={`${data.activeSubscriptions} active subs`} accent="emerald" />
            <StatCard label="Tenant Users" value={data.users.tenant_users} accent="slate" />
            <StatCard label="Modules" value={data.modules}
              hint={`${data.users.super_owners} super owner${data.users.super_owners === 1 ? '' : 's'}`} accent="amber" />
          </div>

          {/* Org growth */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Organization Growth</h2>
            <p className="mb-4 text-xs text-slate-400">New organizations per month (last 6 months)</p>
            {data.growth.length === 0 ? <p className="text-sm text-slate-400">No data yet.</p> : (
              <div className="flex items-end gap-4" style={{ height: 140 }}>
                {data.growth.map(g => {
                  const max = Math.max(1, ...data.growth.map(x => x.n));
                  return (
                    <div key={g.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-xs font-medium text-slate-500">{g.n}</span>
                      <div className="w-full rounded-t-md bg-brand-500" style={{ height: `${(g.n / max) * 100}%`, minHeight: g.n > 0 ? 6 : 0 }} />
                      <span className="text-xs text-slate-400">{g.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Plan distribution */}
            <Card className="p-6 lg:col-span-1">
              <h2 className="text-sm font-semibold text-slate-900">Plan Distribution</h2>
              <p className="mb-4 text-xs text-slate-400">Active subscriptions per plan</p>
              <div className="space-y-3">
                {data.planDistribution.map(p => (
                  <div key={p.code}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{p.name}</span>
                      <span className="text-slate-400">{p.n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(p.n / maxPlan) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {data.planDistribution.length === 0 && <p className="text-sm text-slate-400">No plans yet.</p>}
              </div>
            </Card>

            {/* Recent orgs */}
            <Card className="overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">Recent Organizations</h2>
                <Link href="/organizations" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
                  View all <Icon name="chevronRight" className="w-4 h-4" />
                </Link>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {data.recentOrganizations.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <Link href={`/organizations/${o.id}`} className="font-medium text-slate-900 hover:text-brand-700">{o.name}</Link>
                        <div className="text-xs text-slate-400">{o.slug}</div>
                      </td>
                      <td className="px-6 py-3 text-slate-500">{o.plan_name ?? '—'}</td>
                      <td className="px-6 py-3 text-slate-500">{o.user_count} users</td>
                      <td className="px-6 py-3"><Badge tone={o.status}>{o.status}</Badge></td>
                    </tr>
                  ))}
                  {data.recentOrganizations.length === 0 && (
                    <tr><td className="px-6 py-8 text-center text-slate-400">No organizations yet</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </Shell>
  );
}
