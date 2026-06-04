'use client';

/**
 * Metadata-driven record manager for a custom object. Renders the list and a
 * create form entirely from the object's field definitions — no per-object code.
 */
import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

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

          {loading ? <p className="text-xs text-slate-400">Loading records…</p> : records.length === 0 ? (
            <p className="text-xs text-slate-400">No records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    {fields.slice(0, 5).map(f => <th key={f.id} className="px-2 py-2 font-semibold text-slate-600">{f.label}</th>)}
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      {fields.slice(0, 5).map(f => <td key={f.id} className="px-2 py-2 text-slate-700">{display(r.data[f.api_name])}</td>)}
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => del(r.id)} className="text-red-500 hover:text-red-700">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
