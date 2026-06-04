'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ────────────────────────────────────────────────────────────────────
interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  requires_document: boolean;
}

interface PolicyVersion {
  id: string;
  name: string;
  description: string | null;
  effective_date: string;
  status: 'draft' | 'active' | 'superseded';
  is_active: boolean;
  created_by_email: string | null;
  activated_by_email: string | null;
  activated_at: string | null;
  rule_count: number;
  created_at: string;
}

interface PolicyRule {
  leave_type_id: string;
  leave_type_name: string;
  color: string;
  id?: string;
  days_per_year: number;
  carry_forward_allowed: boolean;
  max_carry_forward: number;
  gender_specific: 'male' | 'female' | null;
  requires_document: boolean;
  pro_rata: boolean;
}

// ── Color palette ────────────────────────────────────────────────────────────
const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
];

function ColorDot({ color, size = 12 }: { color: string; size?: number }) {
  return <span className="inline-block rounded-full flex-shrink-0" style={{ width: size, height: size, background: color }} />;
}

function StatusPill({ status, isActive }: { status: string; isActive: boolean }) {
  if (isActive) return (
    <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />ACTIVE
    </span>
  );
  if (status === 'draft') return (
    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">DRAFT</span>
  );
  if (status === 'superseded') return (
    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-400">SUPERSEDED</span>
  );
  return null;
}

function isUpcoming(version: PolicyVersion) {
  return version.status === 'draft' && new Date(version.effective_date) > new Date();
}

// ────────────────────────────────────────────────────────────────────────────
// Leave Types Panel
// ────────────────────────────────────────────────────────────────────────────
function LeaveTypesPanel() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0], requires_document: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/leave-types');
      const data = await res.json();
      setTypes(data.types || []);
    } catch { toast.error('Failed to load leave types'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', description: '', color: COLORS[0], requires_document: false });
    setModalOpen(true);
  }

  function openEdit(t: LeaveType) {
    setEditing(t);
    setForm({ name: t.name, description: t.description || '', color: t.color, requires_document: t.requires_document });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/leave-types/${editing.id}` : '/api/admin/leave-types';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success(editing ? 'Leave type updated' : 'Leave type created');
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete leave type "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/leave-types/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Leave type deleted');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500">{types.length} leave types configured</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Icon name="PlusIcon" size={16} /> Add Leave Type
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">
          <Icon name="ArrowPathIcon" size={20} className="animate-spin mx-auto mb-2" />Loading…
        </div>
      ) : types.length === 0 ? (
        <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
          <Icon name="TagIcon" size={32} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium">No leave types yet</p>
          <p className="text-sm mt-1">Add your first leave type to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {types.map(t => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-start hover:border-slate-300 transition-colors">
              <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: t.color + '20' }}>
                <ColorDot color={t.color} size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 justify-between">
                  <p className="font-semibold text-slate-800 text-sm truncate">{t.name}</p>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(t)} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors">
                      <Icon name="PencilIcon" size={14} />
                    </button>
                    <button onClick={() => del(t.id, t.name)} disabled={deleting === t.id} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors disabled:opacity-50">
                      {deleting === t.id ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="TrashIcon" size={14} />}
                    </button>
                  </div>
                </div>
                {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                <div className="flex gap-2 mt-2">
                  {t.requires_document && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">Doc required</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">{editing ? 'Edit Leave Type' : 'New Leave Type'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><Icon name="XMarkIcon" size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Annual Leave"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requires_document}
                  onChange={e => setForm(f => ({ ...f, requires_document: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <span className="text-sm font-medium text-slate-700">Requires supporting document</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Type'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Rules Editor
// ────────────────────────────────────────────────────────────────────────────
function RulesEditor({ version, onClose, onSaved }: { version: PolicyVersion; onClose: () => void; onSaved: () => void }) {
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/leave-policy-versions/${version.id}/rules`)
      .then(r => r.json())
      .then(d => {
        const loaded: PolicyRule[] = (d.rules || []).map((r: any) => ({
          leave_type_id: r.leave_type_id,
          leave_type_name: r.leave_type_name,
          color: r.color || '#3b82f6',
          id: r.id,
          days_per_year: r.days_per_year ?? 0,
          carry_forward_allowed: r.carry_forward_allowed ?? false,
          max_carry_forward: r.max_carry_forward ?? 0,
          gender_specific: r.gender_specific ?? null,
          requires_document: r.requires_document ?? false,
          pro_rata: r.pro_rata ?? false,
        }));
        setRules(loaded);
      })
      .catch(() => toast.error('Failed to load rules'))
      .finally(() => setLoading(false));
  }, [version.id]);

  function update(idx: number, field: keyof PolicyRule, value: any) {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leave-policy-versions/${version.id}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Rules saved');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isSuperseded = version.status === 'superseded';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 my-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">Policy Rules</h3>
              <StatusPill status={version.status} isActive={version.is_active} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{version.name} · Effective {new Date(version.effective_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="XMarkIcon" size={20} /></button>
        </div>

        {isSuperseded && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium flex items-center gap-2">
            <Icon name="ExclamationCircleIcon" size={14} />
            This version is superseded (read-only). Activate it to make changes.
          </div>
        )}

        <div className="p-6 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400"><Icon name="ArrowPathIcon" size={20} className="animate-spin mx-auto mb-2" />Loading rules…</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">No leave types found. Add leave types first.</div>
          ) : (
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 font-semibold text-slate-600 text-xs uppercase tracking-wider w-48">Leave Type</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Days/Year</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Carry Forward</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Max Carry</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Gender</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Doc Req.</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Pro-Rata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rules.map((rule, idx) => (
                  <tr key={rule.leave_type_id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <ColorDot color={rule.color} size={10} />
                        <span className="font-medium text-slate-800 text-sm">{rule.leave_type_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number" min="0" max="365"
                        value={rule.days_per_year}
                        onChange={e => update(idx, 'days_per_year', parseInt(e.target.value) || 0)}
                        disabled={isSuperseded}
                        className="w-16 text-center border border-slate-200 rounded-lg py-1.5 px-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={rule.carry_forward_allowed}
                        onChange={e => update(idx, 'carry_forward_allowed', e.target.checked)}
                        disabled={isSuperseded}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 disabled:opacity-50"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number" min="0" max="365"
                        value={rule.max_carry_forward}
                        onChange={e => update(idx, 'max_carry_forward', parseInt(e.target.value) || 0)}
                        disabled={isSuperseded || !rule.carry_forward_allowed}
                        className="w-16 text-center border border-slate-200 rounded-lg py-1.5 px-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <select
                        value={rule.gender_specific || ''}
                        onChange={e => update(idx, 'gender_specific', e.target.value || null)}
                        disabled={isSuperseded}
                        className="border border-slate-200 rounded-lg py-1.5 px-2 text-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                      >
                        <option value="">All</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={rule.requires_document}
                        onChange={e => update(idx, 'requires_document', e.target.checked)}
                        disabled={isSuperseded}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 disabled:opacity-50"
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={rule.pro_rata}
                        onChange={e => update(idx, 'pro_rata', e.target.checked)}
                        disabled={isSuperseded}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 disabled:opacity-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0 border-t border-slate-100 mt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Close</button>
          {!isSuperseded && (
            <button onClick={save} disabled={saving || loading} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save Rules'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Policy Versions Panel
// ────────────────────────────────────────────────────────────────────────────
function PolicyVersionsPanel() {
  const { profile } = useAuth();
  const email = profile?.email ?? null;
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [rulesVersion, setRulesVersion] = useState<PolicyVersion | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<PolicyVersion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/leave-policy-versions');
      const data = await res.json();
      setVersions(data.versions || []);
    } catch { toast.error('Failed to load policy versions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function activate(v: PolicyVersion) {
    if (!confirm(`Activate "${v.name}"? The current active policy will be superseded.`)) return;
    setActivating(v.id);
    try {
      const res = await fetch(`/api/admin/leave-policy-versions/${v.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activated_by_email: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${v.name}" is now the active policy`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActivating(null);
    }
  }

  async function del(v: PolicyVersion) {
    if (!confirm(`Delete policy version "${v.name}"? This cannot be undone.`)) return;
    setDeleting(v.id);
    try {
      const res = await fetch(`/api/admin/leave-policy-versions/${v.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Version deleted');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const active = versions.find(v => v.is_active);
  const drafts = versions.filter(v => !v.is_active && v.status === 'draft');
  const superseded = versions.filter(v => v.status === 'superseded');

  function VersionCard({ v }: { v: PolicyVersion }) {
    const upcoming = isUpcoming(v);
    return (
      <div className={`border rounded-xl p-5 transition-all ${v.is_active ? 'border-emerald-300 bg-emerald-50/30' : upcoming ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${v.is_active ? 'bg-emerald-500' : upcoming ? 'bg-blue-500' : 'bg-slate-300'}`} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-slate-900">{v.name}</h4>
                <StatusPill status={v.status} isActive={v.is_active} />
                {upcoming && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">UPCOMING</span>}
              </div>
              {v.description && <p className="text-sm text-slate-500 mt-0.5">{v.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Icon name="CalendarIcon" size={12} />
                  Effective {new Date(v.effective_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span>{v.rule_count} rule{v.rule_count !== 1 ? 's' : ''}</span>
                {v.activated_by_email && (
                  <span className="flex items-center gap-1">
                    <Icon name="UserIcon" size={12} />
                    Activated by {v.activated_by_email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setRulesVersion(v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Icon name="TableCellsIcon" size={13} />
              {v.status === 'superseded' ? 'View Rules' : 'Edit Rules'}
            </button>

            {v.status !== 'active' && (
              <button
                onClick={() => setEditModal(v)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Edit"
              >
                <Icon name="PencilIcon" size={14} />
              </button>
            )}

            {!v.is_active && v.status !== 'superseded' && (
              <button
                onClick={() => activate(v)}
                disabled={activating === v.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {activating === v.id ? <Icon name="ArrowPathIcon" size={12} className="animate-spin" /> : <Icon name="BoltIcon" size={12} />}
                Activate
              </button>
            )}

            {!v.is_active && (
              <button
                onClick={() => del(v)}
                disabled={deleting === v.id}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Delete"
              >
                {deleting === v.id ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="TrashIcon" size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{versions.length} version{versions.length !== 1 ? 's' : ''} · {active ? `"${active.name}" is active` : 'No active policy'}</p>
        <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Icon name="PlusIcon" size={16} /> New Version
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400"><Icon name="ArrowPathIcon" size={20} className="animate-spin mx-auto mb-2" />Loading…</div>
      ) : versions.length === 0 ? (
        <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
          <Icon name="DocumentTextIcon" size={32} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium">No policy versions yet</p>
          <p className="text-sm mt-1">Create your first version to define leave entitlements</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Active Policy</p>
              <VersionCard v={active} />
            </div>
          )}
          {drafts.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Draft / Upcoming</p>
              <div className="space-y-2">{drafts.map(v => <VersionCard key={v.id} v={v} />)}</div>
            </div>
          )}
          {superseded.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Superseded</p>
              <div className="space-y-2">{superseded.map(v => <VersionCard key={v.id} v={v} />)}</div>
            </div>
          )}
        </div>
      )}

      {rulesVersion && (
        <RulesEditor version={rulesVersion} onClose={() => setRulesVersion(null)} onSaved={load} />
      )}

      {createModal && (
        <VersionFormModal
          versions={versions}
          onClose={() => setCreateModal(false)}
          onSaved={() => { setCreateModal(false); load(); }}
          userEmail={email}
        />
      )}

      {editModal && (
        <VersionFormModal
          editing={editModal}
          versions={versions}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); load(); }}
          userEmail={email}
        />
      )}
    </div>
  );
}

// ── Version create/edit modal ────────────────────────────────────────────────
function VersionFormModal({
  editing, versions, onClose, onSaved, userEmail,
}: {
  editing?: PolicyVersion;
  versions: PolicyVersion[];
  onClose: () => void;
  onSaved: () => void;
  userEmail?: string | null;
}) {
  const [form, setForm] = useState({
    name: editing?.name || '',
    description: editing?.description || '',
    effective_date: editing?.effective_date?.split('T')[0] || '',
    copy_from: '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.effective_date) { toast.error('Effective date is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/admin/leave-policy-versions/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, description: form.description, effective_date: form.effective_date }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success('Version updated');
      } else {
        const res = await fetch('/api/admin/leave-policy-versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            effective_date: form.effective_date,
            copy_from_version_id: form.copy_from || null,
            created_by_email: userEmail,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success('Version created');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{editing ? 'Edit Version' : 'New Policy Version'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="XMarkIcon" size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Version Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 2025 Leave Policy" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Effective Date *</label>
            <input type="date" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} className="input-field" />
            <p className="text-xs text-slate-400 mt-1">The date this policy version takes effect when activated.</p>
          </div>
          {!editing && versions.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Copy rules from</label>
              <select value={form.copy_from} onChange={e => setForm(f => ({ ...f, copy_from: e.target.value }))} className="input-field">
                <option value="">Start blank</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.rule_count} rules)</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Copies all rules from the selected version as a starting point.</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Version'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Leave Requests Panel (admin CRUD)
// ────────────────────────────────────────────────────────────────────────────
interface LeaveRequest {
  id: string;
  employee_name: string;
  employee_email: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approver_notes: string | null;
  approver_email: string | null;
  approved_at: string | null;
  days_count: number;
  created_at: string;
}

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected'] as const;

function LeaveRequestsPanel() {
  const { profile } = useAuth();
  const currentUserEmail = (profile?.email ?? '').toLowerCase();

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [editModal, setEditModal] = useState<LeaveRequest | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [createModal, setCreateModal] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = tab === 'all' ? '' : `?status=${tab}`;
      const [lRes, tRes] = await Promise.all([
        fetch(`/api/leave-requests${q}`).then(r => r.json()),
        fetch('/api/admin/leave-types').then(r => r.json()),
      ]);
      setLeaves(lRes.data || []);
      setLeaveTypes(tRes.types || []);
    } catch { toast.error('Failed to load leave requests'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string, action: 'approved' | 'rejected') {
    setApproving(id);
    try {
      const res = await fetch(`/api/leave-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, approver_notes: noteMap[id] || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Leave ${action}`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setApproving(null);
    }
  }

  async function cancelLeave(id: string) {
    if (!confirm('Cancel this approved leave? The employee will be notified.')) return;
    setCancelling(id);
    try {
      const res = await fetch(`/api/leave-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancelled', approver_notes: noteMap[id] || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Approved leave cancelled');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancelling(null);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this leave request? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/leave-requests/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Leave request deleted');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const counts = {
    all: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  };

  const typeColor: Record<string, string> = {};
  leaveTypes.forEach(t => { typeColor[t.name] = t.color; });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {STATUS_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
            </button>
          ))}
        </div>
        <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Icon name="PlusIcon" size={16} /> New Request
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400"><Icon name="ArrowPathIcon" size={20} className="animate-spin mx-auto mb-2" />Loading…</div>
      ) : leaves.length === 0 ? (
        <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
          <Icon name="CalendarDaysIcon" size={32} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium">No leave requests</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Dates</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Days</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaves.map(leave => (
                <tr key={leave.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{leave.employee_name}</p>
                    {leave.employee_email && <p className="text-xs text-slate-400">{leave.employee_email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <ColorDot color={typeColor[leave.leave_type] || '#94a3b8'} size={8} />
                      <span className="text-slate-700">{leave.leave_type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {new Date(leave.start_date).toLocaleDateString()} → {new Date(leave.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{leave.days_count}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      leave.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{leave.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end flex-wrap">
                      {leave.status === 'pending' && (() => {
                        const isSelf = currentUserEmail && leave.employee_email &&
                          leave.employee_email.toLowerCase() === currentUserEmail;
                        return isSelf ? (
                          <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded" title="You cannot approve your own leave">
                            <Icon name="NoSymbolIcon" size={11} /> Own leave
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => approve(leave.id, 'approved')}
                              disabled={approving === leave.id}
                              className="px-2 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >✓ Approve</button>
                            <button
                              onClick={() => approve(leave.id, 'rejected')}
                              disabled={approving === leave.id}
                              className="px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >✗ Reject</button>
                          </>
                        );
                      })()}
                      {leave.status === 'approved' && (() => {
                        const isSelf = currentUserEmail && leave.employee_email &&
                          leave.employee_email.toLowerCase() === currentUserEmail;
                        return !isSelf ? (
                          <button
                            onClick={() => cancelLeave(leave.id)}
                            disabled={cancelling === leave.id}
                            className="px-2 py-1 text-xs font-semibold bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            {cancelling === leave.id
                              ? <Icon name="ArrowPathIcon" size={11} className="animate-spin" />
                              : null
                            }
                            Cancel
                          </button>
                        ) : null;
                      })()}
                      <button onClick={() => setEditModal(leave)} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors" title="Edit">
                        <Icon name="PencilIcon" size={14} />
                      </button>
                      <button onClick={() => del(leave.id)} disabled={deleting === leave.id} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors disabled:opacity-50" title="Delete">
                        {deleting === leave.id ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="TrashIcon" size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editModal || createModal) && (
        <LeaveRequestFormModal
          editing={editModal || undefined}
          leaveTypes={leaveTypes}
          onClose={() => { setEditModal(null); setCreateModal(false); }}
          onSaved={() => { setEditModal(null); setCreateModal(false); load(); }}
        />
      )}
    </div>
  );
}

function LeaveRequestFormModal({
  editing, leaveTypes, onClose, onSaved,
}: {
  editing?: LeaveRequest;
  leaveTypes: LeaveType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    employee_name: editing?.employee_name || '',
    employee_email: editing?.employee_email || '',
    leave_type: editing?.leave_type || '',
    start_date: editing?.start_date?.split('T')[0] || '',
    end_date: editing?.end_date?.split('T')[0] || '',
    reason: editing?.reason || '',
    days_count: editing?.days_count || 1,
    status: editing?.status || 'pending',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.employee_name.trim() || !form.leave_type || !form.start_date || !form.end_date) {
      toast.error('Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/leave-requests/${editing.id}` : '/api/leave-requests',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Leave request updated' : 'Leave request created');
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{editing ? 'Edit Leave Request' : 'New Leave Request'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="XMarkIcon" size={20} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Employee Name *</label>
            <input type="text" value={form.employee_name} onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))} className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Employee Email</label>
            <input type="email" value={form.employee_email} onChange={e => setForm(f => ({ ...f, employee_email: e.target.value }))} className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Leave Type *</label>
            <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))} className="input-field">
              <option value="">Select type</option>
              {leaveTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Start Date *</label>
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">End Date *</label>
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Days Count</label>
            <input type="number" min="1" value={form.days_count} onChange={e => setForm(f => ({ ...f, days_count: parseInt(e.target.value) || 1 }))} className="input-field" />
          </div>
          {editing && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} className="input-field">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reason</label>
            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Icon name="ArrowPathIcon" size={14} className="animate-spin" />}
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────────────────────
type SubTab = 'requests' | 'types' | 'versions';

const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'requests', label: 'Leave Requests', icon: 'InboxStackIcon' },
  { id: 'types',    label: 'Leave Types',    icon: 'TagIcon' },
  { id: 'versions', label: 'Policy Versions', icon: 'DocumentDuplicateIcon' },
];

export default function LeaveManagementTab() {
  const [subTab, setSubTab] = useState<SubTab>('requests');

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              subTab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon name={t.icon as any} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'requests' && <LeaveRequestsPanel />}
      {subTab === 'types'    && <LeaveTypesPanel />}
      {subTab === 'versions' && <PolicyVersionsPanel />}
    </div>
  );
}
