'use client';

/**
 * Metadata-driven record manager for a custom object. Renders the list and a
 * create form entirely from the object's field definitions — no per-object code.
 */
import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import Sheet from '@/components/ui/Sheet';
import ResponsiveTable, { type Column } from '@/components/ui/ResponsiveTable';

interface Field {
  id: string; api_name: string; label: string; field_type: string;
  is_required: boolean; picklist_values: string[] | null; lookup_object_id: string | null;
}
interface Rec { id: string; data: Record<string, any>; owner_email: string; created_at: string; }

export default function DynamicRecordsPanel({ apiName, label }: { apiName: string; label: string }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Sharing
  const [shareRec, setShareRec] = useState<Rec | null>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [accessLevels, setAccessLevels] = useState<string[]>([]);
  const [shareForm, setShareForm] = useState({ principal_type: 'user', principal_id: '', access_level: 'view' });

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/objects/${apiName}/records`)
      .then(r => r.json())
      .then(d => { setFields(d.fields || []); setRecords(d.data || []); })
      .catch(() => toast.error('Failed to load records'))
      .finally(() => setLoading(false));
  }, [apiName]);
  useEffect(() => { load(); }, [load]);

  // Only fields the user can input (skip formula — computed)
  const inputFields = fields.filter(f => f.field_type !== 'formula');

  function renderInput(f: Field) {
    const val = form[f.api_name] ?? '';
    const set = (v: any) => setForm(prev => ({ ...prev, [f.api_name]: v }));
    const base = 'w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5';
    switch (f.field_type) {
      case 'boolean':
        return <input type="checkbox" checked={!!form[f.api_name]} onChange={e => set(e.target.checked)} />;
      case 'number': case 'currency': case 'percent':
        return <input type="number" value={val} onChange={e => set(e.target.value)} className={base} />;
      case 'date':
        return <input type="date" value={val} onChange={e => set(e.target.value)} className={base} />;
      case 'datetime':
        return <input type="datetime-local" value={val} onChange={e => set(e.target.value)} className={base} />;
      case 'email':
        return <input type="email" value={val} onChange={e => set(e.target.value)} className={base} />;
      case 'url':
        return <input type="url" value={val} onChange={e => set(e.target.value)} className={base} />;
      case 'richtext':
        return <textarea value={val} onChange={e => set(e.target.value)} rows={3} className={base} />;
      case 'picklist':
        return (
          <select value={val} onChange={e => set(e.target.value)} className={base}>
            <option value="">Select…</option>
            {(f.picklist_values || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'multipicklist':
        return (
          <div className="flex flex-wrap gap-2">
            {(f.picklist_values || []).map(o => {
              const arr: string[] = form[f.api_name] || [];
              return (
                <label key={o} className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={arr.includes(o)}
                    onChange={e => set(e.target.checked ? [...arr, o] : arr.filter(x => x !== o))} />
                  {o}
                </label>
              );
            })}
          </div>
        );
      default:
        return <input type="text" value={val} onChange={e => set(e.target.value)} className={base} />;
    }
  }

  async function create() {
    setSaving(true); setErrors({});
    try {
      const res = await fetch(`/api/objects/${apiName}/records`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: form }),
      });
      const d = await res.json();
      if (res.status === 422) { setErrors(d.fields || {}); toast.error('Please fix the highlighted fields'); return; }
      if (!res.ok) throw new Error(d.error);
      toast.success(`${label} record created`); setForm({}); setShowForm(false); load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create record');
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    const res = await fetch(`/api/objects/${apiName}/records/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Record deleted'); load();
  }

  async function openShares(rec: Rec) {
    setShareRec(rec);
    const res = await fetch(`/api/objects/${apiName}/records/${rec.id}/shares`);
    if (!res.ok) { toast.error((await res.json()).error); setShareRec(null); return; }
    const d = await res.json();
    setShares(d.shares || []); setAccessLevels(d.accessLevels || []);
  }
  async function addShare() {
    if (!shareRec || !shareForm.principal_id.trim()) return;
    const res = await fetch(`/api/objects/${apiName}/records/${shareRec.id}/shares`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shareForm),
    });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Shared'); setShareForm({ principal_type: 'user', principal_id: '', access_level: 'view' }); openShares(shareRec);
  }
  async function removeShare(shareId: string) {
    if (!shareRec) return;
    const res = await fetch(`/api/objects/${apiName}/records/${shareRec.id}/shares`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ share_id: shareId }),
    });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Share removed'); openShares(shareRec);
  }

  function display(v: any) {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800">{label} Records</h3>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">
          <Icon name="PlusIcon" size={12} /> New Record
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-slate-400">Define fields for this object first.</p>
      ) : (
        <>
          {showForm && (
            <div className="border border-blue-200 rounded-lg p-3 mb-4 space-y-2">
              {inputFields.map(f => (
                <div key={f.id}>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                    {f.label}{f.is_required && <span className="text-red-500">*</span>}
                    <span className="text-slate-300 font-normal ml-1">({f.field_type})</span>
                  </label>
                  {renderInput(f)}
                  {errors[f.api_name] && <p className="text-[10px] text-red-500 mt-0.5">{errors[f.api_name]}</p>}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={create} disabled={saving} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">Save</button>
                <button onClick={() => { setShowForm(false); setErrors({}); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2.5" role="status" aria-label="Loading records">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            (() => {
              const cols: Column<Rec>[] = fields.slice(0, 5).map((f, i) => ({
                key: f.id,
                header: f.label,
                primary: i === 0,
                render: (r: Rec) => display(r.data[f.api_name]),
              }));
              return (
                <ResponsiveTable
                  columns={cols}
                  rows={records}
                  keyOf={(r) => r.id}
                  emptyText="No records yet."
                  actions={(r) => (
                    <>
                      <button onClick={() => openShares(r)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Share</button>
                      <button onClick={() => del(r.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                    </>
                  )}
                />
              );
            })()
          )}
        </>
      )}

      {/* Share sheet (bottom sheet on mobile, dialog on desktop) */}
      <Sheet open={!!shareRec} onClose={() => setShareRec(null)} title="Share record">
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <select value={shareForm.principal_type} onChange={e => setShareForm(s => ({ ...s, principal_type: e.target.value }))} className="text-sm border border-slate-200 rounded-lg px-2 py-2">
            {['user', 'role', 'role_group', 'department'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={shareForm.principal_id} onChange={e => setShareForm(s => ({ ...s, principal_id: e.target.value }))} placeholder={shareForm.principal_type === 'user' ? 'email' : shareForm.principal_type === 'role_group' ? 'group id' : shareForm.principal_type} className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-3 py-2" />
          <select value={shareForm.access_level} onChange={e => setShareForm(s => ({ ...s, access_level: e.target.value }))} className="text-sm border border-slate-200 rounded-lg px-2 py-2">
            {(accessLevels.length ? accessLevels : ['view', 'edit', 'full']).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={addShare} className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg">Share</button>
        </div>

        {shares.length === 0 ? <p className="text-xs text-slate-400">No shares yet. The owner and admins always have full access.</p> : (
          <div className="space-y-1.5">
            {shares.map(s => (
              <div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{s.principal_type}: {s.principal_id}</p>
                  <p className="text-[11px] text-slate-400">{s.access_level}</p>
                </div>
                <button onClick={() => removeShare(s.id)} className="text-xs text-red-500 hover:text-red-700 font-medium flex-shrink-0">Remove</button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
