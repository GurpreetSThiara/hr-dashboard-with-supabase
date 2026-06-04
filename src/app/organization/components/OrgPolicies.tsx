'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { useRoleBasedAccess } from '@/lib/useRoleBasedAccess';

interface Policy {
  id: string; title: string; category: string; content: string | null;
  version: number; effective_date: string | null; expiry_date: string | null;
  requires_acknowledgement: boolean; acknowledged: boolean; acknowledged_at: string | null;
  expired: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  HR: 'bg-violet-100 text-violet-700',
  Attendance: 'bg-blue-100 text-blue-700',
  Leave: 'bg-emerald-100 text-emerald-700',
  Expense: 'bg-amber-100 text-amber-700',
  Travel: 'bg-cyan-100 text-cyan-700',
  Compliance: 'bg-red-100 text-red-700',
  General: 'bg-slate-100 text-slate-600',
};

export default function OrgPolicies() {
  const { hasPermission } = useRoleBasedAccess();
  const canManage = hasPermission('manage_policies');

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'General', content: '', effective_date: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/organization/policies')
      .then((r) => (r.ok ? r.json() : { policies: [] }))
      .then((d) => setPolicies(d.policies || []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function acknowledge(id: string) {
    setAcking(id);
    try {
      const res = await fetch(`/api/organization/policies/${id}/acknowledge`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Policy acknowledged');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to acknowledge');
    } finally {
      setAcking(null);
    }
  }

  async function createPolicy() {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/organization/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Policy published');
      setShowForm(false);
      setForm({ title: '', category: 'General', content: '', effective_date: '', expiry_date: '' });
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to publish');
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = policies.filter((p) => p.requires_acknowledgement && !p.acknowledged && !p.expired).length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
        <p className="text-sm text-slate-500">Loading policies…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Policy Repository</h3>
          {pendingCount > 0 && (
            <p className="text-xs text-amber-600 font-semibold mt-0.5">
              {pendingCount} policy{pendingCount > 1 ? ' acknowledgements' : ' acknowledgement'} pending
            </p>
          )}
        </div>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
            <Icon name="PlusIcon" size={13} /> New Policy
          </button>
        )}
      </div>

      {showForm && canManage && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Policy title" className="col-span-2 text-sm border border-slate-300 rounded-lg px-3 py-2" />
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="text-sm border border-slate-300 rounded-lg px-3 py-2">
              {['General','HR','Attendance','Leave','Expense','Travel','Compliance'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="date" value={form.effective_date} onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))} className="text-xs border border-slate-300 rounded-lg px-2 py-2 flex-1" title="Effective date" />
              <input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} className="text-xs border border-slate-300 rounded-lg px-2 py-2 flex-1" title="Expiry date" />
            </div>
            <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Policy content…" rows={4} className="col-span-2 text-sm border border-slate-300 rounded-lg px-3 py-2 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={createPolicy} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">Publish</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {policies.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${CATEGORY_COLORS[p.category] || CATEGORY_COLORS.General}`}>{p.category}</span>
                  <h4 className="text-sm font-bold text-slate-800">{p.title}</h4>
                  <span className="text-[10px] text-slate-400">v{p.version}</span>
                  {p.expired && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">EXPIRED</span>}
                </div>
                <p className={`text-xs text-slate-600 ${expanded === p.id ? '' : 'line-clamp-2'}`}>{p.content}</p>
                {p.content && p.content.length > 140 && (
                  <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="text-[11px] text-blue-600 font-semibold mt-1">
                    {expanded === p.id ? 'Show less' : 'Read more'}
                  </button>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                  {p.effective_date && <span>Effective {new Date(p.effective_date).toLocaleDateString('en-GB')}</span>}
                  {p.expiry_date && <span>· Expires {new Date(p.expiry_date).toLocaleDateString('en-GB')}</span>}
                </div>
              </div>
              <div className="flex-shrink-0">
                {p.requires_acknowledgement && (
                  p.acknowledged ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <Icon name="CheckCircleIcon" size={14} /> Acknowledged
                    </span>
                  ) : (
                    <button
                      onClick={() => acknowledge(p.id)}
                      disabled={acking === p.id || p.expired}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50"
                    >
                      {acking === p.id ? '…' : 'Acknowledge'}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
        {policies.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No policies published yet.</p>}
      </div>
    </div>
  );
}
