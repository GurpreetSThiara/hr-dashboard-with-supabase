'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, MODULE_LABELS } from '@/lib/api';
import { Card, Button, Badge, PageHeader, Loading, ErrorBanner, EmptyState, Modal, Field, inputClass } from '@/components/ui';
import Icon from '@/components/Icon';

interface Module { id: string; code: string; name: string; description: string | null; plan_count: number; }

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const load = useCallback(async () => {
    setError(null);
    try { setModules((await api<{ data: Module[] }>('/api/modules')).data); }
    catch (e: any) { setError(e.message); setModules([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createModule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/api/modules', { method: 'POST', body: JSON.stringify(form) });
      setOpen(false); setForm({ code: '', name: '', description: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Shell>
      <PageHeader title="Modules" subtitle="The catalog of features that plans can enable."
        actions={<Button onClick={() => setOpen(true)}><Icon name="plus" className="w-4 h-4" /> New Module</Button>} />
      <ErrorBanner message={error} />

      {modules === null ? <Loading /> : modules.length === 0 ? (
        <Card><EmptyState title="No modules yet" hint="Create modules, then enable them on plans." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(m => (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon name="grid" className="w-5 h-5" /></div>
                  <div>
                    <h2 className="font-semibold text-slate-900">{MODULE_LABELS[m.code] ?? m.name}</h2>
                    <code className="text-xs text-slate-400">{m.code}</code>
                  </div>
                </div>
                <Badge tone={m.plan_count > 0 ? 'brand' : 'neutral'}>{m.plan_count} plan{m.plan_count === 1 ? '' : 's'}</Badge>
              </div>
              {m.description && <p className="mt-3 text-sm text-slate-500">{m.description}</p>}
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create Module">
        <form onSubmit={createModule} className="space-y-4">
          <Field label="Code"><input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className={inputClass} placeholder="reporting" /></Field>
          <Field label="Name"><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Reporting" /></Field>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} rows={2} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
