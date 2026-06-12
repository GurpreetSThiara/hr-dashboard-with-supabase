'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { Card, Button, Badge, PageHeader, Loading, ErrorBanner, EmptyState, Modal, Field, inputClass } from '@/components/ui';
import Icon from '@/components/Icon';

interface Announcement {
  id: string; scope: string; organization_id: string | null; organization_name: string | null;
  title: string; body: string | null; level: string; is_active: boolean; ends_at: string | null; created_at: string;
}
interface Org { id: string; name: string; }

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', level: 'info', scope: 'global', organizationId: '', endsAt: '' });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, o] = await Promise.all([api<{ data: Announcement[] }>('/api/announcements'), api<{ data: Org[] }>('/api/organizations')]);
      setItems(a.data); setOrgs(o.data);
    } catch (e: any) { setError(e.message); setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/api/announcements', { method: 'POST', body: JSON.stringify({
        title: form.title, body: form.body || undefined, level: form.level, scope: form.scope,
        organizationId: form.scope === 'organization' ? form.organizationId : undefined,
        endsAt: form.endsAt || undefined,
      }) });
      setOpen(false); setForm({ title: '', body: '', level: 'info', scope: 'global', organizationId: '', endsAt: '' });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function toggle(a: Announcement) {
    try { await api(`/api/announcements/${a.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !a.is_active }) }); await load(); }
    catch (e: any) { setError(e.message); }
  }
  async function remove(a: Announcement) {
    if (!confirm('Delete this announcement?')) return;
    try { await api(`/api/announcements/${a.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <Shell>
      <PageHeader title="Announcements" subtitle="Broadcast notices to all tenants or a single organization."
        actions={<Button onClick={() => setOpen(true)}><Icon name="plus" className="w-4 h-4" /> New Announcement</Button>} />
      <ErrorBanner message={error} />

      {items === null ? <Loading /> : items.length === 0 ? (
        <Card><EmptyState title="No announcements" hint="Create one to notify organizations inside the HR app." /></Card>
      ) : (
        <div className="space-y-3">
          {items.map(a => (
            <Card key={a.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.level === 'critical' ? 'suspended' : a.level === 'warning' ? 'warning' : 'brand'}>{a.level}</Badge>
                  <span className="font-semibold text-slate-900">{a.title}</span>
                  <Badge>{a.scope === 'global' ? 'Global' : a.organization_name ?? 'Organization'}</Badge>
                  {!a.is_active && <Badge tone="archived">inactive</Badge>}
                </div>
                {a.body && <p className="mt-1 text-sm text-slate-500">{a.body}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(a.created_at).toLocaleString()}{a.ends_at ? ` · ends ${new Date(a.ends_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => toggle(a)}>{a.is_active ? 'Deactivate' : 'Activate'}</Button>
                <Button variant="ghost" onClick={() => remove(a)}><Icon name="x" className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Announcement">
        <form onSubmit={create} className="space-y-4">
          <Field label="Title"><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} /></Field>
          <Field label="Body"><textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className={inputClass} rows={2} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level">
              <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className={inputClass}>
                <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Scope">
              <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} className={inputClass}>
                <option value="global">All organizations</option><option value="organization">One organization</option>
              </select>
            </Field>
          </div>
          {form.scope === 'organization' && (
            <Field label="Organization">
              <select required value={form.organizationId} onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))} className={inputClass}>
                <option value="">Select…</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Ends at (optional)"><input type="date" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} className={inputClass} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</Button>
          </div>
        </form>
      </Modal>
    </Shell>
  );
}
