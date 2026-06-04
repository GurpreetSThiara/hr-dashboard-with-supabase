'use client';

/**
 * Standard Objects console — system entities (Employee, Leave Request, …).
 *  - Objects are READ-ONLY (no create/edit/delete).
 *  - Standard fields/relationships: visibility toggle only (locked otherwise).
 *  - Custom fields/relationships on standard objects: full CRUD.
 */
import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

const FIELD_TYPES = ['text','number','currency','percent','date','datetime','email','phone','url','picklist','boolean','richtext'];

// ── Loading skeletons (match the final rendered layout to avoid layout shift) ──
function SkeletonObjectRow() {
  return (
    <div className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 animate-pulse" aria-hidden="true">
      <div className="w-[18px] h-[18px] rounded bg-slate-200 flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 bg-slate-200 rounded w-2/3" />
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function SkeletonFieldRow() {
  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-[13px] h-[13px] rounded bg-slate-200 flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-2.5 bg-slate-200 rounded w-1/2" />
          <div className="h-2 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
      <div className="h-5 w-14 bg-slate-200 rounded flex-shrink-0" />
    </div>
  );
}

function SkeletonFieldGrid({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="status" aria-label="Loading fields">
      {Array.from({ length: rows }).map((_, i) => <SkeletonFieldRow key={i} />)}
      <span className="sr-only">Loading fields…</span>
    </div>
  );
}

interface SObject { id: string; api_name: string; label: string; plural_label: string | null; description: string | null; icon: string; standard_field_count: number; custom_field_count: number; }
interface SField {
  id: string; api_name: string; label: string; data_type: string;
  is_relationship: boolean; related_object: string | null; is_custom: boolean;
  is_visible: boolean; is_required: boolean; picklist_values: string[] | null;
}

export default function StandardObjectsTab() {
  const [objects, setObjects] = useState<SObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SObject | null>(null);
  const [stdFields, setStdFields] = useState<SField[]>([]);
  const [customFields, setCustomFields] = useState<SField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ label: '', is_relationship: false, data_type: 'text', related_object: '', is_required: false, picklist_values: '' });

  const loadObjects = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/standard-objects').then(r => r.json())
      .then(d => setObjects(d.objects || [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadObjects(); }, [loadObjects]);

  const loadFields = useCallback((o: SObject) => {
    setSelected(o);
    setFieldsLoading(true);
    fetch(`/api/admin/standard-objects/${o.api_name}`).then(r => r.json()).then(d => {
      setStdFields(d.standardFields || []); setCustomFields(d.customFields || []);
    }).finally(() => setFieldsLoading(false));
  }, []);

  async function toggleVisible(f: SField) {
    if (!selected) return;
    const res = await fetch(`/api/admin/standard-objects/${selected.api_name}/fields/${f.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_visible: !f.is_visible }),
    });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success(`${f.label} ${!f.is_visible ? 'shown' : 'hidden'}`); loadFields(selected);
  }
  async function addCustom() {
    if (!selected || !form.label.trim()) return;
    const payload: any = { label: form.label, is_relationship: form.is_relationship, is_required: form.is_required };
    if (form.is_relationship) { payload.data_type = 'lookup'; payload.related_object = form.related_object; }
    else { payload.data_type = form.data_type; if (form.data_type === 'picklist') payload.picklist_values = form.picklist_values.split(',').map((s: string) => s.trim()).filter(Boolean); }
    const res = await fetch(`/api/admin/standard-objects/${selected.api_name}/fields`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Custom field added'); setShowForm(false);
    setForm({ label: '', is_relationship: false, data_type: 'text', related_object: '', is_required: false, picklist_values: '' });
    loadFields(selected); loadObjects();
  }
  async function deleteCustom(f: SField) {
    if (!selected || !confirm(`Delete custom field "${f.label}"?`)) return;
    const res = await fetch(`/api/admin/standard-objects/${selected.api_name}/fields/${f.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Deleted'); loadFields(selected); loadObjects();
  }

  function FieldRow({ f, custom }: { f: SField; custom: boolean }) {
    return (
      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          {f.is_relationship
            ? <Icon name="ArrowsRightLeftIcon" size={13} className="text-indigo-500 flex-shrink-0" />
            : <Icon name="Bars3BottomLeftIcon" size={13} className="text-slate-400 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">
              {f.label}
              {f.is_relationship && f.related_object && <span className="text-indigo-500 font-normal"> → {f.related_object}</span>}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">{f.api_name} · {f.data_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Visibility toggle — available for BOTH standard and custom */}
          <button onClick={() => toggleVisible(f)}
            className={`text-[11px] font-semibold px-2 py-1 rounded ${f.is_visible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
            {f.is_visible ? 'Visible' : 'Hidden'}
          </button>
          {custom ? (
            <button onClick={() => deleteCustom(f)} className="text-[11px] text-red-500 hover:text-red-700 font-medium">Delete</button>
          ) : (
            <span title="System field — locked" className="text-slate-300"><Icon name="LockClosedIcon" size={13} /></span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Object list */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Standard Objects</h3>
        <p className="text-[11px] text-slate-400 mb-3">System entities — read-only. Manage their fields & relationships on the right.</p>
        {loading ? (
          <div className="space-y-2" role="status" aria-label="Loading standard objects">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonObjectRow key={i} />)}
            <span className="sr-only">Loading standard objects…</span>
          </div>
        ) : (
          <div className="space-y-2">
            {objects.map(o => (
              <button key={o.id} onClick={() => loadFields(o)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition ${selected?.id === o.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                <Icon name={o.icon as any} size={18} className="text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    {o.label}
                    <Icon name="LockClosedIcon" size={11} className="text-slate-300" />
                  </p>
                  <p className="text-[11px] text-slate-400">{o.standard_field_count} standard · {o.custom_field_count} custom</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="lg:col-span-2 space-y-4">
        {!selected ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-400">
            Select a standard object to manage its fields and relationships.
          </div>
        ) : (
          <>
            {/* Standard fields */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="LockClosedIcon" size={14} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800">Standard Fields & Relationships</h3>
                <span className="text-[11px] text-slate-400">— visibility toggle only; cannot be renamed or deleted</span>
              </div>
              {fieldsLoading ? (
                <SkeletonFieldGrid rows={8} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stdFields.map(f => <FieldRow key={f.id} f={f} custom={false} />)}
                </div>
              )}
            </div>

            {/* Custom fields */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon name="SparklesIcon" size={14} className="text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-800">Custom Fields & Relationships</h3>
                </div>
                <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">
                  <Icon name="PlusIcon" size={12} /> Add Custom
                </button>
              </div>

              {showForm && (
                <div className="border border-blue-200 rounded-lg p-3 mb-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <input value={form.label} onChange={e => setForm((f: any) => ({ ...f, label: e.target.value }))} placeholder="Label" className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                    <label className="flex items-center gap-1 text-[11px] text-slate-600 whitespace-nowrap">
                      <input type="checkbox" checked={form.is_relationship} onChange={e => setForm((f: any) => ({ ...f, is_relationship: e.target.checked }))} /> Relationship
                    </label>
                  </div>
                  {form.is_relationship ? (
                    <select value={form.related_object} onChange={e => setForm((f: any) => ({ ...f, related_object: e.target.value }))} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                      <option value="">Related object…</option>
                      {objects.map(o => <option key={o.api_name} value={o.api_name}>{o.label}</option>)}
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <select value={form.data_type} onChange={e => setForm((f: any) => ({ ...f, data_type: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {form.data_type === 'picklist' && (
                        <input value={form.picklist_values} onChange={e => setForm((f: any) => ({ ...f, picklist_values: e.target.value }))} placeholder="Comma-separated values" className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-[11px] text-slate-600"><input type="checkbox" checked={form.is_required} onChange={e => setForm((f: any) => ({ ...f, is_required: e.target.checked }))} /> Required</label>
                    <button onClick={addCustom} className="ml-auto px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg">Add</button>
                  </div>
                </div>
              )}

              {fieldsLoading ? (
                <SkeletonFieldGrid rows={2} />
              ) : customFields.length === 0 ? (
                <p className="text-xs text-slate-400">No custom fields yet on this object.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {customFields.map(f => <FieldRow key={f.id} f={f} custom={true} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
