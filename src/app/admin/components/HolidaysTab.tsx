'use client';

/**
 * Admin Holiday Management Tab
 * Sub-tabs: Holidays | Policies | Assignments
 */

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import ResponsiveTable from '@/components/ui/ResponsiveTable';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Holiday {
  id: string;
  name: string;
  date: string;
  year: number;
  holiday_type: 'mandatory' | 'optional';
  description?: string;
  is_recurring: boolean;
  is_archived: boolean;
  country_code?: string;
  region?: string;
  policy_names?: string[];
  created_by?: string;
}

interface Policy {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  holiday_count: number;
  assignment_count: number;
}

type SubTab = 'holidays' | 'policies';

const HOLIDAY_TYPE_COLORS = {
  mandatory: 'bg-orange-100 text-orange-700 border-orange-200',
  optional:  'bg-sky-100 text-sky-700 border-sky-200',
};

const currentYear = new Date().getFullYear();

// ── Main Component ────────────────────────────────────────────────────────────

export default function HolidaysTab() {
  const [subTab, setSubTab] = useState<SubTab>('holidays');

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: 'holidays',  label: 'Holidays Calendar', icon: 'CalendarDaysIcon' },
          { id: 'policies',  label: 'Holiday Policies',  icon: 'DocumentTextIcon' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              subTab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon name={t.icon as any} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'holidays' && <HolidaysPanel />}
      {subTab === 'policies' && <PoliciesPanel />}
    </div>
  );
}

// ── Holidays Panel ────────────────────────────────────────────────────────────

function HolidaysPanel() {
  const [holidays, setHolidays]         = useState<Holiday[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [yearFilter, setYearFilter]     = useState(currentYear.toString());
  const [typeFilter, setTypeFilter]     = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [editHoliday, setEditHoliday]   = useState<Holiday | null>(null);
  const [policies, setPolicies]         = useState<Policy[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: '', date: '', holiday_type: 'mandatory' as 'mandatory' | 'optional',
    description: '', is_recurring: false, country_code: 'IN', region: '',
    policy_ids: [] as string[],
  });
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ archived: String(showArchived) });
    if (yearFilter) p.set('year', yearFilter);
    if (typeFilter) p.set('type', typeFilter);

    Promise.all([
      fetch(`/api/admin/holidays?${p}`).then(r => r.json()),
      fetch('/api/admin/holiday-policies').then(r => r.json()),
    ]).then(([hols, pols]) => {
      setHolidays(Array.isArray(hols) ? hols : []);
      setPolicies(Array.isArray(pols) ? pols : []);
      setLoading(false);
    }).catch(() => { toast.error('Failed to load holidays'); setLoading(false); });
  }, [showArchived, yearFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditHoliday(null);
    setForm({ name:'', date:'', holiday_type:'mandatory', description:'', is_recurring:false, country_code:'IN', region:'', policy_ids:[] });
    setShowForm(true);
  }

  function openEdit(h: Holiday) {
    setEditHoliday(h);
    setForm({
      name: h.name, date: h.date.slice(0, 10), holiday_type: h.holiday_type,
      description: h.description || '', is_recurring: h.is_recurring,
      country_code: h.country_code || 'IN', region: h.region || '',
      policy_ids: (h.policy_names || []).length > 0
        ? policies.filter(p => h.policy_names?.includes(p.name)).map(p => p.id)
        : [],
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.name || !form.date) { toast.error('Name and date are required'); return; }
    setSaving(true);
    try {
      const url    = editHoliday ? `/api/admin/holidays/${editHoliday.id}` : '/api/admin/holidays';
      const method = editHoliday ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(editHoliday ? 'Holiday updated' : 'Holiday created');
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/holidays/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Holiday archived');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  async function restore(id: string) {
    try {
      const res = await fetch(`/api/admin/holidays/${id}`, { method: 'PATCH' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Holiday restored');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center flex-wrap gap-3">
        <div className="flex gap-2 flex-1 flex-wrap">
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All types</option>
            <option value="mandatory">Mandatory</option>
            <option value="optional">Optional</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded" />
            Show archived
          </label>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
          <Icon name="PlusIcon" size={13} />
          Add Holiday
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6">
          <h4 className="font-semibold text-slate-900 mb-4">
            {editHoliday ? 'Edit Holiday' : 'New Holiday'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Holiday Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Republic Day"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Type</label>
              <select value={form.holiday_type} onChange={e => setForm(f => ({ ...f, holiday_type: e.target.value as any }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="mandatory">Mandatory</option>
                <option value="optional">Optional</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Country Code</label>
              <input value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))}
                placeholder="IN"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Region / State</label>
              <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                placeholder="e.g. MH, KA"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Assign to Policies</label>
              <div className="flex flex-wrap gap-2">
                {policies.map(p => (
                  <label key={p.id} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    <input type="checkbox"
                      checked={form.policy_ids.includes(p.id)}
                      onChange={e => setForm(f => ({
                        ...f,
                        policy_ids: e.target.checked
                          ? [...f.policy_ids, p.id]
                          : f.policy_ids.filter(id => id !== p.id)
                      }))}
                      className="rounded" />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} className="rounded" />
                Recurring annually (same month/day every year)
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving && <Icon name="ArrowPathIcon" size={12} className="animate-spin" />}
              {editHoliday ? 'Update' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table / cards */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-0 sm:overflow-hidden">
        {loading ? (
          <div className="p-3 sm:p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <ResponsiveTable
            rows={holidays}
            keyOf={(h) => h.id}
            emptyText="No holidays found"
            columns={[
              { key: 'name', header: 'Holiday', primary: true, render: (h) => (
                <span className={h.is_archived ? 'opacity-50' : ''}>
                  <span className="font-medium text-slate-800">{h.name}</span>
                  {h.description && <span className="block text-xs text-slate-400">{h.description}</span>}
                </span>
              )},
              { key: 'date', header: 'Date', render: (h) => new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
              { key: 'type', header: 'Type', render: (h) => (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${HOLIDAY_TYPE_COLORS[h.holiday_type]}`}>{h.holiday_type}</span>
              )},
              { key: 'recurring', header: 'Recurring', render: (h) => (h.is_recurring ? '✓ Yes' : '—') },
              { key: 'policies', header: 'Policies', render: (h) => (
                (h.policy_names || []).length > 0
                  ? <span className="inline-flex flex-wrap gap-1 justify-end">{h.policy_names!.map(p => <span key={p} className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded">{p}</span>)}</span>
                  : <span className="text-slate-400 text-xs">None</span>
              )},
            ]}
            actions={(h) => (
              !h.is_archived ? (
                <>
                  <button onClick={() => openEdit(h)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  <button onClick={() => archive(h.id)} disabled={deleting === h.id} className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                    {deleting === h.id ? '…' : 'Archive'}
                  </button>
                </>
              ) : (
                <button onClick={() => restore(h.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Restore</button>
              )
            )}
          />
        )}
      </div>
    </div>
  );
}

// ── Policies Panel ────────────────────────────────────────────────────────────

function PoliciesPanel() {
  const [policies, setPolicies]   = useState<Policy[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: '', description: '', is_default: false });
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/holiday-policies')
      .then(r => r.json())
      .then(d => { setPolicies(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { toast.error('Failed to load policies'); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/holiday-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Policy created');
      setShowForm(false);
      setForm({ name: '', description: '', is_default: false });
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/holiday-policies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Policy deleted');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  }

  async function setDefault(id: string) {
    try {
      const res = await fetch(`/api/admin/holiday-policies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Default policy updated');
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Holiday Policies</h3>
            <p className="text-xs text-slate-500 mt-0.5">Named calendar bundles assigned to teams, departments, or employees</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
            <Icon name="PlusIcon" size={13} />
            New Policy
          </button>
        </div>

        {showForm && (
          <div className="px-6 py-4 bg-blue-50 border-b border-slate-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Policy Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. India Corporate Calendar"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="rounded" />
                  Set as default policy (applies company-wide unless overridden)
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={create} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving && <Icon name="ArrowPathIcon" size={12} className="animate-spin" />}
                Create
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-3 sm:p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="p-3 sm:p-0">
          <ResponsiveTable
            rows={policies}
            keyOf={(p) => p.id}
            emptyText="No policies configured"
            columns={[
              { key: 'name', header: 'Policy', primary: true, render: (p) => (
                <span>
                  <span className="inline-flex items-center gap-2">
                    <span className="font-medium text-slate-800">{p.name}</span>
                    {p.is_default && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">DEFAULT</span>}
                  </span>
                  {p.description && <span className="block text-xs text-slate-400 mt-0.5">{p.description}</span>}
                </span>
              )},
              { key: 'holidays', header: 'Holidays', render: (p) => p.holiday_count },
              { key: 'assigned', header: 'Assigned To', render: (p) => `${p.assignment_count} scope(s)` },
              { key: 'status', header: 'Status', render: (p) => (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              )},
            ]}
            actions={(p) => (
              <>
                {!p.is_default && (
                  <button onClick={() => setDefault(p.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Set Default</button>
                )}
                <button onClick={() => del(p.id)} disabled={deleting === p.id || p.is_default}
                  title={p.is_default ? 'Cannot delete the default policy' : 'Delete'}
                  className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  {deleting === p.id ? '…' : 'Delete'}
                </button>
              </>
            )}
          />
          </div>
        )}
      </div>
    </div>
  );
}
