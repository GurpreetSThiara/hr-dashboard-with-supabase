'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, MODULE_LABELS } from '@/lib/api';
import { Card, Button, Badge, PageHeader, Loading, ErrorBanner, Modal, Field, inputClass } from '@/components/ui';
import Icon from '@/components/Icon';

interface Plan {
  id: string; code: string; name: string; description: string | null; limits: any;
  is_active: boolean; modules: string[]; price_monthly: number | null; price_yearly: number | null; currency: string;
}
interface Module { code: string; name: string; }

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [edit, setEdit] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', price_monthly: '', price_yearly: '', max_employees: '', is_active: true });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, m] = await Promise.all([api<{ data: Plan[] }>('/api/plans'), api<{ data: Module[] }>('/api/modules')]);
      setPlans(p.data); setModules(m.data);
    } catch (e: any) { setError(e.message); setPlans([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleModule(plan: Plan, code: string) {
    const next = plan.modules.includes(code) ? plan.modules.filter(c => c !== code) : [...plan.modules, code];
    setBusyId(plan.id); setError(null);
    setPlans(prev => prev!.map(p => p.id === plan.id ? { ...p, modules: next } : p));
    try { await api(`/api/plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ moduleCodes: next }) }); }
    catch (e: any) { setError(e.message); await load(); } finally { setBusyId(null); }
  }
  async function toggleActive(plan: Plan) {
    setBusyId(plan.id);
    try { await api(`/api/plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !plan.is_active }) }); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusyId(null); }
  }
  function openEdit(p: Plan) {
    setEdit(p);
    setEditForm({
      name: p.name, description: p.description ?? '',
      price_monthly: p.price_monthly?.toString() ?? '', price_yearly: p.price_yearly?.toString() ?? '',
      max_employees: p.limits?.max_employees?.toString() ?? '', is_active: p.is_active,
    });
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusyId(edit.id); setError(null);
    try {
      const limits = { ...(edit.limits ?? {}) };
      if (editForm.max_employees === '') delete limits.max_employees; else limits.max_employees = Number(editForm.max_employees);
      await api(`/api/plans/${edit.id}`, { method: 'PATCH', body: JSON.stringify({
        name: editForm.name, description: editForm.description, is_active: editForm.is_active,
        price_monthly: editForm.price_monthly === '' ? null : Number(editForm.price_monthly),
        price_yearly: editForm.price_yearly === '' ? null : Number(editForm.price_yearly),
        limits,
      }) });
      setEdit(null); await load();
    } catch (e: any) { setError(e.message); } finally { setBusyId(null); }
  }
  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setError(null);
    try { await api('/api/plans', { method: 'POST', body: JSON.stringify(form) }); setOpen(false); setForm({ code: '', name: '', description: '' }); await load(); }
    catch (e: any) { setError(e.message); } finally { setCreating(false); }
  }

  return (
    <Shell>
      <PageHeader title="Plans" subtitle="Subscription tiers, pricing, seat limits, and module access."
        actions={<>
          <Button variant="secondary" onClick={() => setShowMatrix(v => !v)}>{showMatrix ? 'Hide matrix' : 'Module matrix'}</Button>
          <Button onClick={() => setOpen(true)}><Icon name="plus" className="w-4 h-4" /> New Plan</Button>
        </>} />
      <ErrorBanner message={error} />

      {plans === null ? <Loading /> : (
        <>
          {/* F22: plan × module matrix */}
          {showMatrix && (
            <Card className="mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-4 py-3 font-medium">Module</th>{plans.map(p => <th key={p.id} className="px-4 py-3 text-center font-medium">{p.name}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modules.map(m => (
                    <tr key={m.code}>
                      <td className="px-4 py-2 font-medium text-slate-700">{MODULE_LABELS[m.code] ?? m.name}</td>
                      {plans.map(p => (
                        <td key={p.id} className="px-4 py-2 text-center">
                          {p.modules.includes(m.code)
                            ? <Icon name="check" className="mx-auto w-4 h-4 text-emerald-500" />
                            : <span className="text-slate-300">·</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {plans.map(plan => (
              <Card key={plan.id} className="flex flex-col p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
                    <code className="text-xs text-slate-400">{plan.code}</code>
                  </div>
                  <button onClick={() => toggleActive(plan)} title="Toggle active"
                    className={`relative h-6 w-11 rounded-full transition-colors ${plan.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${plan.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-slate-900">
                    {plan.price_monthly != null ? `$${plan.price_monthly}` : '—'}
                  </span>
                  <span className="text-sm text-slate-400">/mo</span>
                </div>
                <p className="text-xs text-slate-400">
                  Seats: {plan.limits?.max_employees ?? 'unlimited'} · {plan.price_yearly != null ? `$${plan.price_yearly}/yr` : 'no annual price'}
                </p>
                {plan.description && <p className="mt-2 text-sm text-slate-500">{plan.description}</p>}

                <div className="mt-4 flex-1">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Modules ({plan.modules.length}/{modules.length})</p>
                  <div className="space-y-1.5">
                    {modules.map(m => {
                      const on = plan.modules.includes(m.code);
                      return (
                        <button key={m.code} disabled={busyId === plan.id} onClick={() => toggleModule(plan, m.code)}
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                            on ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                          <span>{MODULE_LABELS[m.code] ?? m.name}</span>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${on ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>
                            {on && <Icon name="check" className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button variant="secondary" className="mt-4" onClick={() => openEdit(plan)}>Edit plan</Button>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create Plan">
        <form onSubmit={createPlan} className="space-y-4">
          <Field label="Code"><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inputClass} placeholder="starter" /></Field>
          <Field label="Name"><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Starter" /></Field>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} rows={2} /></Field>
          <p className="text-xs text-slate-400">Set pricing, seats and modules after creating.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Edit ${edit?.name ?? ''}`}>
        <form onSubmit={saveEdit} className="space-y-4">
          <Field label="Name"><input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputClass} /></Field>
          <Field label="Description"><textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={inputClass} rows={2} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="$/month"><input type="number" min="0" value={editForm.price_monthly} onChange={e => setEditForm(f => ({ ...f, price_monthly: e.target.value }))} className={inputClass} /></Field>
            <Field label="$/year"><input type="number" min="0" value={editForm.price_yearly} onChange={e => setEditForm(f => ({ ...f, price_yearly: e.target.value }))} className={inputClass} /></Field>
            <Field label="Max seats"><input type="number" min="0" value={editForm.max_employees} onChange={e => setEditForm(f => ({ ...f, max_employees: e.target.value }))} className={inputClass} placeholder="∞" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))} /> Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button type="submit" disabled={busyId === edit?.id}>Save</Button>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
