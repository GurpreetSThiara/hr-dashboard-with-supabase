'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { Card, Button, PageHeader, Loading, ErrorBanner, EmptyState, Modal, Field, inputClass } from '@/components/ui';
import Icon from '@/components/Icon';

interface Flag { key: string; description: string | null; enabled: boolean; updated_at: string; }

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ key: '', description: '' });

  const load = useCallback(async () => {
    setError(null);
    try { setFlags((await api<{ data: Flag[] }>('/api/feature-flags')).data); }
    catch (e: any) { setError(e.message); setFlags([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(f: Flag) {
    setFlags(prev => prev!.map(x => x.key === f.key ? { ...x, enabled: !x.enabled } : x));
    try { await api('/api/feature-flags', { method: 'PUT', body: JSON.stringify({ key: f.key, enabled: !f.enabled }) }); }
    catch (e: any) { setError(e.message); await load(); }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/api/feature-flags', { method: 'PUT', body: JSON.stringify({ key: form.key, description: form.description, enabled: false }) });
      setOpen(false); setForm({ key: '', description: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Shell>
      <PageHeader title="Feature Flags" subtitle="Global flags the HR app reads at runtime."
        actions={<Button onClick={() => setOpen(true)}><Icon name="plus" className="w-4 h-4" /> New Flag</Button>} />
      <ErrorBanner message={error} />

      {flags === null ? <Loading /> : flags.length === 0 ? (
        <Card><EmptyState title="No feature flags" hint="Create a flag, then gate HR features on it." /></Card>
      ) : (
        <div className="space-y-3">
          {flags.map(f => (
            <Card key={f.key} className="flex items-center justify-between gap-4 p-4">
              <div>
                <code className="text-sm font-semibold text-slate-900">{f.key}</code>
                {f.description && <p className="text-sm text-slate-500">{f.description}</p>}
              </div>
              <button onClick={() => toggle(f)}
                className={`relative h-6 w-11 rounded-full transition-colors ${f.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${f.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Feature Flag">
        <form onSubmit={create} className="space-y-4">
          <Field label="Key"><input required value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} className={inputClass} placeholder="beta_xyz" /></Field>
          <Field label="Description"><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
