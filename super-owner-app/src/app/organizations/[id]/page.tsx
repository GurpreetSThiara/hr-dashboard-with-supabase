'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { api, MODULE_LABELS } from '@/lib/api';
import { Card, Button, Badge, Loading, ErrorBanner, Field, inputClass, Modal } from '@/components/ui';
import Icon from '@/components/Icon';

interface OrgDetail {
  id: string; name: string; slug: string; status: string; created_at: string;
  plan_code: string | null; plan_name: string | null; user_count: number;
  maintenance_mode: boolean; primary_color: string | null; logo_url: string | null;
  notes: string | null; primary_contact_email: string | null;
  suspended_reason: string | null; last_active_at: string | null;
  modules: string[];
  subscriptionHistory: { id: string; status: string; plan_name: string; starts_at: string; ends_at: string | null }[];
}
interface Plan { id: string; code: string; name: string; }
interface OrgUser { id: string; email: string; full_name: string | null; role: string; tier: number; department: string | null; }
interface ModuleRow { code: string; name: string; inPlan: boolean; override: 'enabled' | 'disabled' | null; effective: boolean; }

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<OrgUser[] | null>(null);
  const [mods, setMods] = useState<ModuleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', primary_color: '#4f46e5', logo_url: '', notes: '', primary_contact_email: '' });
  const [endsAt, setEndsAt] = useState('');
  const [provision, setProvision] = useState(false);
  const [padmin, setPadmin] = useState({ email: '', password: '', fullName: '' });
  const [provisioned, setProvisioned] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, p, u, m] = await Promise.all([
        api<OrgDetail>(`/api/organizations/${id}`),
        api<{ data: Plan[] }>('/api/plans'),
        api<{ data: OrgUser[] }>(`/api/organizations/${id}/users`),
        api<{ data: ModuleRow[] }>(`/api/organizations/${id}/modules`),
      ]);
      setOrg(o); setPlans(p.data); setUsers(u.data); setMods(m.data);
      setForm({
        name: o.name, primary_color: o.primary_color ?? '#4f46e5', logo_url: o.logo_url ?? '',
        notes: o.notes ?? '', primary_contact_email: o.primary_contact_email ?? '',
      });
    } catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function patch(body: any) {
    setBusy(true); setError(null);
    try { await api(`/api/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function changePlan(planCode: string) {
    setBusy(true); setError(null);
    try {
      await api(`/api/organizations/${id}/subscription`, { method: 'PUT', body: JSON.stringify({ planCode, endsAt: endsAt || null }) });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function setOverride(code: string, override: 'enabled' | 'disabled' | null) {
    setBusy(true); setError(null);
    try {
      await api(`/api/organizations/${id}/modules`, { method: 'PUT', body: JSON.stringify({ moduleCode: code, override }) });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  function suspendWithReason() {
    const reason = window.prompt('Reason for suspension (shown to the org):', '');
    if (reason === null) return;
    patch({ status: 'suspended', suspended_reason: reason });
  }
  async function startTrial(days: number) {
    if (!org?.plan_code) { setError('Assign a plan first to start a trial.'); return; }
    const d = new Date(); d.setDate(d.getDate() + days);
    setBusy(true); setError(null);
    try {
      await api(`/api/organizations/${id}/subscription`, { method: 'PUT', body: JSON.stringify({ planCode: org.plan_code, endsAt: d.toISOString() }) });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function provisionAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setProvisioned(null);
    try {
      await api(`/api/organizations/${id}/provision-admin`, { method: 'POST', body: JSON.stringify(padmin) });
      setProvisioned(padmin.email);
      setPadmin({ email: '', password: '', fullName: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Shell>
      <Link href="/organizations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <Icon name="arrowLeft" className="w-4 h-4" /> Back to organizations
      </Link>
      <ErrorBanner message={error} />

      {!org ? <Loading /> : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-10 w-1.5 rounded-full" style={{ backgroundColor: org.primary_color ?? '#4f46e5' }} />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{org.name}</h1>
                  <Badge tone={org.status}>{org.status}</Badge>
                  {org.maintenance_mode && <Badge tone="warning">maintenance</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {org.slug} · {org.user_count} users · created {new Date(org.created_at).toLocaleDateString()}
                  {org.last_active_at ? ` · last active ${new Date(org.last_active_at).toLocaleDateString()}` : ' · never active'}
                </p>
                {org.status === 'suspended' && org.suspended_reason && (
                  <p className="mt-1 text-sm text-amber-700">Suspended: {org.suspended_reason}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setProvision(true)}>Provision admin</Button>
              <Button variant="secondary" disabled={busy} onClick={() => patch({ maintenance_mode: !org.maintenance_mode })}>
                {org.maintenance_mode ? 'Disable maintenance' : 'Enable maintenance'}
              </Button>
              {org.status !== 'active' && <Button variant="secondary" disabled={busy} onClick={() => patch({ status: 'active', suspended_reason: '' })}>Reactivate</Button>}
              {org.status === 'active' && <Button variant="secondary" disabled={busy} onClick={suspendWithReason}>Suspend</Button>}
              {org.status !== 'archived' && <Button variant="danger" disabled={busy} onClick={() => { if (confirm('Archive this organization?')) patch({ status: 'archived' }); }}>Archive</Button>}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Subscription */}
            <Card className="p-6 lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-900">Subscription</h2>
              <p className="mb-4 text-xs text-slate-400">Plan determines base module access. Set an end date for trials.</p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Plan">
                  <select className={`${inputClass} max-w-[180px]`} disabled={busy} value={org.plan_code ?? ''} onChange={e => changePlan(e.target.value)}>
                    <option value="" disabled>Select…</option>
                    {plans.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Ends at (optional)">
                  <input type="date" className={inputClass} value={endsAt} onChange={e => setEndsAt(e.target.value)} />
                </Field>
                {org.plan_code && <Button variant="secondary" disabled={busy} onClick={() => changePlan(org.plan_code!)}>Apply date</Button>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Trials:</span>
                <Button variant="ghost" disabled={busy} onClick={() => startTrial(14)}>Start 14-day</Button>
                <Button variant="ghost" disabled={busy} onClick={() => startTrial(30)}>Start 30-day</Button>
                {org.plan_code && <Button variant="ghost" disabled={busy} onClick={() => { setEndsAt(''); changePlan(org.plan_code!); }}>End trial</Button>}
              </div>

              <h3 className="mt-6 text-sm font-semibold text-slate-900">Module access</h3>
              <p className="mb-2 text-xs text-slate-400">Override the plan per-organization (add-ons or restrictions).</p>
              <div className="space-y-1.5">
                {mods.map(m => (
                  <div key={m.code} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${m.effective ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>
                        {m.effective && <Icon name="check" className="w-3.5 h-3.5" />}
                      </span>
                      <span className="font-medium text-slate-700">{MODULE_LABELS[m.code] ?? m.name}</span>
                      {m.inPlan && <Badge tone="brand">in plan</Badge>}
                      {m.override && <Badge tone={m.override === 'enabled' ? 'active' : 'archived'}>{m.override}</Badge>}
                    </div>
                    <select className="rounded-lg border border-slate-300 px-2 py-1 text-xs" disabled={busy}
                      value={m.override ?? 'plan'}
                      onChange={e => setOverride(m.code, e.target.value === 'plan' ? null : e.target.value as any)}>
                      <option value="plan">Use plan ({m.inPlan ? 'on' : 'off'})</option>
                      <option value="enabled">Force on</option>
                      <option value="disabled">Force off</option>
                    </select>
                  </div>
                ))}
              </div>
            </Card>

            {/* Branding + meta */}
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-slate-900">Branding & details</h2>
              <div className="mt-3 space-y-3">
                <Field label="Display name">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Primary color">
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="h-9 w-12 rounded border border-slate-300" />
                    <input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className={inputClass} />
                  </div>
                </Field>
                <Field label="Logo URL"><input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} className={inputClass} placeholder="https://…" /></Field>
                <Field label="Primary contact"><input value={form.primary_contact_email} onChange={e => setForm(f => ({ ...f, primary_contact_email: e.target.value }))} className={inputClass} placeholder="admin@org.com" /></Field>
                <Field label="Internal notes"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputClass} rows={3} /></Field>
                <Button disabled={busy} onClick={() => patch(form)} className="w-full">Save details</Button>
              </div>
            </Card>
          </div>

          {/* Users */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
              <Icon name="users" className="w-5 h-5 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Users ({org.user_count})</h2>
            </div>
            {users === null ? <Loading /> : users.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400">No users in this organization.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-6 py-3 font-medium">User</th><th className="px-6 py-3 font-medium">Role</th><th className="px-6 py-3 font-medium">Department</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-6 py-3"><div className="font-medium text-slate-900">{u.full_name || u.email.split('@')[0]}</div><div className="text-xs text-slate-400">{u.email}</div></td>
                      <td className="px-6 py-3"><Badge>{u.role}</Badge></td>
                      <td className="px-6 py-3 text-slate-500">{u.department ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Provision admin */}
          <Modal open={provision} onClose={() => { setProvision(false); setProvisioned(null); }} title="Provision Org Admin">
            {provisioned ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">Admin login ready for <strong>{provisioned}</strong>. They can now sign in to the HR app.</p>
                <Button onClick={() => { setProvision(false); setProvisioned(null); }}>Done</Button>
              </div>
            ) : (
              <form onSubmit={provisionAdmin} className="space-y-4">
                <p className="text-sm text-slate-500">Creates (or resets) an Organization Admin login scoped to this org.</p>
                <Field label="Email"><input type="email" required value={padmin.email} onChange={e => setPadmin(p => ({ ...p, email: e.target.value }))} className={inputClass} /></Field>
                <Field label="Full name"><input value={padmin.fullName} onChange={e => setPadmin(p => ({ ...p, fullName: e.target.value }))} className={inputClass} /></Field>
                <Field label="Temporary password"><input type="text" required value={padmin.password} onChange={e => setPadmin(p => ({ ...p, password: e.target.value }))} className={inputClass} placeholder="min 8 chars" /></Field>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setProvision(false)}>Cancel</Button>
                  <Button type="submit" disabled={busy}>Create login</Button>
                </div>
              </form>
            )}
          </Modal>
        </div>
      )}
    </Shell>
  );
}
