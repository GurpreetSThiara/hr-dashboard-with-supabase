'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { api, downloadCsv } from '@/lib/api';
import { Card, Button, Badge, PageHeader, Loading, ErrorBanner, EmptyState, Modal, Field, inputClass } from '@/components/ui';
import Icon from '@/components/Icon';

interface Org {
  id: string; name: string; slug: string; status: string;
  plan_code: string | null; plan_name: string | null; user_count: number; created_at: string;
  last_active_at: string | null;
}
interface Plan { id: string; code: string; name: string; }

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', planCode: '' });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, p] = await Promise.all([api<{ data: Org[] }>('/api/organizations'), api<{ data: Plan[] }>('/api/plans')]);
      setOrgs(o.data); setPlans(p.data);
    } catch (e: any) { setError(e.message); setOrgs([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!orgs) return [];
    return orgs.filter(o =>
      (statusFilter === 'all' || o.status === statusFilter) &&
      (q === '' || o.name.toLowerCase().includes(q.toLowerCase()) || o.slug.includes(q.toLowerCase()))
    );
  }, [orgs, q, statusFilter]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/api/organizations', { method: 'POST', body: JSON.stringify({ name: form.name, slug: form.slug, planCode: form.planCode || undefined }) });
      setOpen(false); setForm({ name: '', slug: '', planCode: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  // auto-suggest slug from name
  function onName(v: string) {
    setForm(f => ({ ...f, name: v, slug: f.slug || v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
  }

  return (
    <Shell>
      <PageHeader
        title="Organizations" subtitle="All tenants on the platform."
        actions={<>
          <Button variant="secondary" disabled={!filtered.length}
            onClick={() => downloadCsv('organizations.csv', filtered.map(o => ({
              name: o.name, slug: o.slug, status: o.status, plan: o.plan_name ?? '',
              users: o.user_count, created_at: o.created_at, last_active_at: o.last_active_at ?? '',
            })))}>Export CSV</Button>
          <Button onClick={() => setOpen(true)}><Icon name="plus" className="w-4 h-4" /> New Organization</Button>
        </>}
      />
      <ErrorBanner message={error} />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or slug…"
            className={`${inputClass} pl-9`} />
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'suspended', 'archived'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${statusFilter === s ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'}`}>
              {s}
            </button>
          ))}
        </div>
      </Card>

      {orgs === null ? <Loading /> : (
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState title="No organizations found" hint={q || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Create your first organization to get started.'} />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Organization</th>
                  <th className="px-6 py-3 font-medium">Plan</th>
                  <th className="px-6 py-3 font-medium">Users</th>
                  <th className="px-6 py-3 font-medium">Last active</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(o => (
                  <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/organizations/${o.id}`)}>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900">{o.name}</div>
                      <div className="text-xs text-slate-400">{o.slug}</div>
                    </td>
                    <td className="px-6 py-3">{o.plan_name ? <Badge tone="brand">{o.plan_name}</Badge> : <span className="text-slate-400">No plan</span>}</td>
                    <td className="px-6 py-3 text-slate-600">{o.user_count}</td>
                    <td className="px-6 py-3 text-slate-500">{o.last_active_at ? new Date(o.last_active_at).toLocaleDateString() : '—'}</td>
                    <td className="px-6 py-3"><Badge tone={o.status}>{o.status}</Badge></td>
                    <td className="px-6 py-3 text-right text-slate-300"><Icon name="chevronRight" className="ml-auto w-4 h-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create Organization">
        <form onSubmit={createOrg} className="space-y-4">
          <Field label="Name"><input required value={form.name} onChange={e => onName(e.target.value)} className={inputClass} placeholder="Acme Inc." /></Field>
          <Field label="Slug"><input required value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className={inputClass} placeholder="acme" /></Field>
          <Field label="Initial plan (optional)">
            <select value={form.planCode} onChange={e => setForm(f => ({ ...f, planCode: e.target.value }))} className={inputClass}>
              <option value="">No plan</option>
              {plans.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
