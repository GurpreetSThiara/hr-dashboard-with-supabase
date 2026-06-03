'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisibilityRow {
  id: string;
  viewer_role: string;
  scope: string;
  is_active: boolean;
  updated_by?: string;
  updated_at?: string;
}

interface ApprovalRow {
  id: string;
  approver_role: string;
  scope: string;
  is_active: boolean;
  updated_by?: string;
  updated_at?: string;
}

interface DelegateRow {
  id: string;
  delegator_email: string;
  delegate_email: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
}

interface AuditRow {
  id: string;
  leave_request_id?: string;
  actor_email?: string;
  actor_role?: string;
  action: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

interface PreviewData {
  email: string;
  role: string;
  visibilityScope: string;
  approvalScope: string;
  activeDelegations: Array<{ delegator_email: string; delegator_role: string }>;
  totalVisible: number | 'all';
  visibleEmployees: Array<{ id: string; name: string; email: string }>;
  visibleTruncated?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VISIBILITY_SCOPES = ['self', 'direct_reports', 'full_hierarchy', 'department', 'all'] as const;
const APPROVAL_SCOPES   = ['none', 'direct_reports', 'full_hierarchy', 'all'] as const;

const SCOPE_LABELS: Record<string, string> = {
  self:           'Self only',
  direct_reports: 'Direct reports',
  full_hierarchy: 'Full hierarchy',
  department:     'Department',
  all:            'All employees',
  none:           'No approval rights',
};

const SCOPE_COLORS: Record<string, string> = {
  self:           'bg-slate-100 text-slate-600',
  direct_reports: 'bg-blue-100 text-blue-700',
  full_hierarchy: 'bg-violet-100 text-violet-700',
  department:     'bg-amber-100 text-amber-700',
  all:            'bg-emerald-100 text-emerald-700',
  none:           'bg-red-50 text-red-500',
};

type SubTab = 'visibility' | 'approval' | 'delegates' | 'preview' | 'audit';

// ── Main Component ────────────────────────────────────────────────────────────

export default function LeavePermissionsTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('visibility');

  const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
    { id: 'visibility', label: 'Visibility Matrix',   icon: 'EyeIcon' },
    { id: 'approval',   label: 'Approval Matrix',     icon: 'CheckCircleIcon' },
    { id: 'delegates',  label: 'Delegation',          icon: 'UserGroupIcon' },
    { id: 'preview',    label: 'Preview Permissions', icon: 'MagnifyingGlassIcon' },
    { id: 'audit',      label: 'Audit Log',           icon: 'ClipboardDocumentListIcon' },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon name={tab.icon as any} size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'visibility' && <VisibilityMatrixPanel />}
      {activeSubTab === 'approval'   && <ApprovalMatrixPanel />}
      {activeSubTab === 'delegates'  && <DelegationPanel />}
      {activeSubTab === 'preview'    && <PreviewPanel />}
      {activeSubTab === 'audit'      && <AuditLogPanel />}
    </div>
  );
}

// ── Visibility Matrix ─────────────────────────────────────────────────────────

function VisibilityMatrixPanel() {
  const [rows, setRows]     = useState<VisibilityRow[]>([]);
  const [dirty, setDirty]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    fetch('/api/admin/leave-visibility-config')
      .then((r) => r.json())
      .then((data) => { setRows(data); setLoading(false); })
      .catch(() => { toast.error('Failed to load visibility config'); setLoading(false); });
  }, []);

  function handleChange(role: string, scope: string) {
    setDirty((d) => ({ ...d, [role]: scope }));
  }

  async function save() {
    setSaving(true);
    const payload = rows.map((r) => ({
      viewer_role: r.viewer_role,
      scope:       dirty[r.viewer_role] ?? r.scope,
      is_active:   r.is_active,
    }));
    try {
      const res = await fetch('/api/admin/leave-visibility-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: VisibilityRow[] = await res.json();
      setRows(updated);
      setDirty({});
      toast.success('Visibility config saved');
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Leave Visibility Matrix</h3>
          <p className="text-xs text-slate-500 mt-0.5">Controls which leave requests each role can see</p>
        </div>
        {Object.keys(dirty).length > 0 && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="CheckIcon" size={13} />}
            Save Changes
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Role</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Visibility Scope</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide text-right">Last Updated By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const currentScope = dirty[row.viewer_role] ?? row.scope;
            const isDirty = dirty[row.viewer_role] !== undefined;
            return (
              <tr key={row.viewer_role} className={`hover:bg-slate-50 transition-colors ${isDirty ? 'bg-blue-50/40' : ''}`}>
                <td className="px-6 py-3 font-medium text-slate-800">{row.viewer_role}</td>
                <td className="px-6 py-3">
                  <select
                    value={currentScope}
                    onChange={(e) => handleChange(row.viewer_role, e.target.value)}
                    className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {VISIBILITY_SCOPES.map((s) => (
                      <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
                    ))}
                  </select>
                  <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full ${SCOPE_COLORS[currentScope]}`}>
                    {SCOPE_LABELS[currentScope]}
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-xs text-slate-400">
                  {row.updated_by || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Approval Matrix ───────────────────────────────────────────────────────────

function ApprovalMatrixPanel() {
  const [rows, setRows]       = useState<ApprovalRow[]>([]);
  const [dirty, setDirty]     = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    fetch('/api/admin/leave-approval-config')
      .then((r) => r.json())
      .then((data) => { setRows(data); setLoading(false); })
      .catch(() => { toast.error('Failed to load approval config'); setLoading(false); });
  }, []);

  function handleChange(role: string, scope: string) {
    setDirty((d) => ({ ...d, [role]: scope }));
  }

  async function save() {
    setSaving(true);
    const payload = rows.map((r) => ({
      approver_role: r.approver_role,
      scope:         dirty[r.approver_role] ?? r.scope,
      is_active:     r.is_active,
    }));
    try {
      const res = await fetch('/api/admin/leave-approval-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: ApprovalRow[] = await res.json();
      setRows(updated);
      setDirty({});
      toast.success('Approval config saved');
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Leave Approval Matrix</h3>
          <p className="text-xs text-slate-500 mt-0.5">Controls which leaves each role can approve or reject</p>
        </div>
        {Object.keys(dirty).length > 0 && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="CheckIcon" size={13} />}
            Save Changes
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Role</th>
            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Approval Scope</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide text-right">Last Updated By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const currentScope = dirty[row.approver_role] ?? row.scope;
            const isDirty = dirty[row.approver_role] !== undefined;
            return (
              <tr key={row.approver_role} className={`hover:bg-slate-50 transition-colors ${isDirty ? 'bg-blue-50/40' : ''}`}>
                <td className="px-6 py-3 font-medium text-slate-800">{row.approver_role}</td>
                <td className="px-6 py-3">
                  <select
                    value={currentScope}
                    onChange={(e) => handleChange(row.approver_role, e.target.value)}
                    className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {APPROVAL_SCOPES.map((s) => (
                      <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
                    ))}
                  </select>
                  <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full ${SCOPE_COLORS[currentScope]}`}>
                    {SCOPE_LABELS[currentScope]}
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-xs text-slate-400">
                  {row.updated_by || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Delegation Panel ──────────────────────────────────────────────────────────

function DelegationPanel() {
  const [rows, setRows]       = useState<DelegateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    delegator_email: '',
    delegate_email: '',
    start_date: '',
    end_date: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/leave-delegates')
      .then((r) => r.json())
      .then((data) => { setRows(data); setLoading(false); })
      .catch(() => { toast.error('Failed to load delegations'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteRow(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/leave-delegates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('Delegation deactivated');
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  async function createDelegation() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/leave-delegates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Delegation created');
      setShowForm(false);
      setForm({ delegator_email: '', delegate_email: '', start_date: '', end_date: '' });
      load();
    } catch (err: any) {
      toast.error(err.message || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Approval Delegations</h3>
            <p className="text-xs text-slate-500 mt-0.5">Allow someone to act as another person's proxy for approvals</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
          >
            <Icon name="PlusIcon" size={13} />
            New Delegation
          </button>
        </div>

        {showForm && (
          <div className="px-6 py-4 bg-blue-50 border-b border-slate-200">
            <p className="text-xs font-semibold text-blue-800 mb-3">New Delegation</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Delegator email (the authority)</label>
                <input
                  type="email"
                  placeholder="manager@company.com"
                  value={form.delegator_email}
                  onChange={(e) => setForm((f) => ({ ...f, delegator_email: e.target.value }))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Delegate email (acts on behalf)</label>
                <input
                  type="email"
                  placeholder="delegate@company.com"
                  value={form.delegate_email}
                  onChange={(e) => setForm((f) => ({ ...f, delegate_email: e.target.value }))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Start date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">End date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={createDelegation}
                disabled={submitting || !form.delegator_email || !form.delegate_email || !form.start_date || !form.end_date}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting && <Icon name="ArrowPathIcon" size={12} className="animate-spin" />}
                Create
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">
            No delegations configured
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Delegator</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Delegate (acts as)</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Period</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const now = new Date().toISOString().slice(0, 10);
                const isCurrentlyActive = row.is_active && row.start_date <= now && row.end_date >= now;
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-800">{row.delegator_email}</td>
                    <td className="px-6 py-3 text-slate-800">{row.delegate_email}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">
                      {row.start_date} → {row.end_date}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        isCurrentlyActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : row.is_active
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-red-50 text-red-500'
                      }`}>
                        {isCurrentlyActive ? 'Active' : row.is_active ? 'Scheduled / Expired' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {row.is_active && (
                        <button
                          onClick={() => deleteRow(row.id)}
                          disabled={deleting === row.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                        >
                          {deleting === row.id ? 'Deactivating…' : 'Deactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Preview Panel ─────────────────────────────────────────────────────────────

function PreviewPanel() {
  const [email, setEmail]       = useState('');
  const [data, setData]         = useState<PreviewData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function lookup() {
    if (!email) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/admin/leave-permissions-preview?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Effective Permission Preview</h3>
        <p className="text-xs text-slate-500 mb-4">Enter a user's email to see what leave data they can view and approve</p>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="user@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={lookup}
            disabled={!email || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
              : <Icon name="MagnifyingGlassIcon" size={14} />}
            Lookup
          </button>
        </div>
        {error && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}
      </div>

      {data && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
              {data.email[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{data.email}</p>
              <p className="text-xs text-slate-500">{data.role}</p>
            </div>
          </div>

          {/* Scopes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Visibility Scope</p>
              <span className={`px-2.5 py-1 text-sm font-semibold rounded-full ${SCOPE_COLORS[data.visibilityScope]}`}>
                {SCOPE_LABELS[data.visibilityScope]}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Approval Scope</p>
              <span className={`px-2.5 py-1 text-sm font-semibold rounded-full ${SCOPE_COLORS[data.approvalScope]}`}>
                {SCOPE_LABELS[data.approvalScope]}
              </span>
            </div>
          </div>

          {/* Active delegations */}
          {data.activeDelegations.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-800 mb-2">
                <Icon name="ArrowsRightLeftIcon" size={12} className="inline mr-1" />
                Active delegations (this person is acting as):
              </p>
              {data.activeDelegations.map((d, i) => (
                <p key={i} className="text-xs text-amber-700">
                  {d.delegator_email} ({d.delegator_role})
                </p>
              ))}
            </div>
          )}

          {/* Visible employees */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Can see leave requests for{' '}
              <span className="text-blue-700">
                {data.totalVisible === 'all' ? 'all employees' : `${data.totalVisible} employee(s)`}
              </span>
            </p>
            {data.visibleEmployees.length > 0 && (
              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {data.visibleEmployees.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded">
                    <Icon name="UserCircleIcon" size={12} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{e.name || e.email}</span>
                  </div>
                ))}
                {data.visibleTruncated && (
                  <p className="text-xs text-slate-400 italic col-span-2 px-2 pt-1">
                    + more employees (showing first 20)
                  </p>
                )}
              </div>
            )}
            {data.visibleEmployees.length === 0 && data.totalVisible !== 'all' && (
              <p className="text-xs text-slate-400 italic">No employees in visibility scope</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Audit Log Panel ───────────────────────────────────────────────────────────

function AuditLogPanel() {
  const [rows, setRows]         = useState<AuditRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [filterEmail, setFilterEmail] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const LIMIT = 30;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filterEmail)  params.set('actor_email', filterEmail);
    if (filterAction) params.set('action', filterAction);

    fetch(`/api/admin/leave-audit?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.data || []);
        setTotal(d.pagination?.total || 0);
        setLoading(false);
      })
      .catch(() => { toast.error('Failed to load audit log'); setLoading(false); });
  }, [page, filterEmail, filterAction]);

  useEffect(() => { load(); }, [load]);

  const ACTION_COLORS: Record<string, string> = {
    submitted: 'bg-blue-100 text-blue-700',
    approved:  'bg-emerald-100 text-emerald-700',
    rejected:  'bg-red-100 text-red-600',
    cancelled: 'bg-orange-100 text-orange-700',
    updated:   'bg-slate-100 text-slate-600',
    deleted:   'bg-red-50 text-red-400',
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-3">Leave Audit Log</h3>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Filter by actor email…"
            value={filterEmail}
            onChange={(e) => { setFilterEmail(e.target.value); setPage(1); }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All actions</option>
            {['submitted','approved','rejected','cancelled','updated','deleted'].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button onClick={load} className="p-2 text-slate-400 hover:text-slate-700">
            <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="px-6 py-8 text-center">
          <Icon name="ArrowPathIcon" size={20} className="animate-spin mx-auto text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-slate-400">No audit entries found</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">When</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Actor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Leave ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString('en-GB')}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-slate-700">{row.actor_email || '—'}</p>
                  {row.actor_role && (
                    <p className="text-[11px] text-slate-400">{row.actor_role}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${ACTION_COLORS[row.action] || 'bg-slate-100 text-slate-600'}`}>
                    {row.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                  {row.leave_request_id ? row.leave_request_id.slice(0, 8) + '…' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{total} entries</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function LoadingCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <Icon name="ArrowPathIcon" size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  );
}
