'use client';

/**
 * Custom Objects console — define dynamic business entities and their fields
 * without code, and manage their records (Phase 2 metadata + Phase 3 data).
 */
import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import DynamicRecordsPanel from './DynamicRecordsPanel';
import Sheet from '@/components/ui/Sheet';

const FIELD_TYPES = [
  'text','number','currency','percent','date','datetime','email','phone','url',
  'picklist','multipicklist','boolean','formula','richtext','file','lookup','multilookup',
] as const;
const PICKLIST_TYPES = ['picklist', 'multipicklist'];
const LOOKUP_TYPES = ['lookup', 'multilookup'];

interface CObject { id: string; api_name: string; label: string; plural_label: string | null; description: string | null; field_count: number; }
interface CField {
  id: string; api_name: string; label: string; field_type: string;
  is_required: boolean; is_unique: boolean; display_order: number;
  picklist_values: string[] | null; lookup_object_id: string | null; formula: string | null;
}

export default function CustomObjectsTab() {
  const [objects, setObjects] = useState<CObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CObject | null>(null);
  const [fields, setFields] = useState<CField[]>([]);
  const [objForm, setObjForm] = useState({ label: '', description: '' });
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldForm, setFieldForm] = useState<any>({ label: '', field_type: 'text', is_required: false, is_unique: false, picklist_values: '', lookup_object_id: '', formula: '' });
  const [recordsObject, setRecordsObject] = useState<CObject | null>(null);

  // Field-Level Security config
  const [flsField, setFlsField] = useState<CField | null>(null);
  const [flsRows, setFlsRows] = useState<any[]>([]);
  const [flsNew, setFlsNew] = useState({ principal_type: 'role', principal_id: '', can_view: true, can_edit: false });

  const loadObjects = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/custom-objects').then(r => r.json())
      .then(d => setObjects(d.objects || [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadObjects(); }, [loadObjects]);

  const loadFields = useCallback((o: CObject) => {
    setSelected(o);
    fetch(`/api/admin/custom-objects/${o.id}`).then(r => r.json()).then(d => setFields(d.fields || []));
  }, []);

  async function createObject() {
    if (!objForm.label.trim()) return;
    const res = await fetch('/api/admin/custom-objects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(objForm) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Object created'); setObjForm({ label: '', description: '' }); loadObjects();
  }
  async function archiveObject(o: CObject) {
    if (!confirm(`Archive object "${o.label}"?`)) return;
    const res = await fetch(`/api/admin/custom-objects/${o.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Archived'); if (selected?.id === o.id) setSelected(null); loadObjects();
  }
  async function addField() {
    if (!selected || !fieldForm.label.trim()) return;
    const payload: any = { label: fieldForm.label, field_type: fieldForm.field_type, is_required: fieldForm.is_required, is_unique: fieldForm.is_unique };
    if (PICKLIST_TYPES.includes(fieldForm.field_type)) payload.picklist_values = fieldForm.picklist_values.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (LOOKUP_TYPES.includes(fieldForm.field_type)) payload.lookup_object_id = fieldForm.lookup_object_id;
    if (fieldForm.field_type === 'formula') payload.formula = fieldForm.formula;
    const res = await fetch(`/api/admin/custom-objects/${selected.id}/fields`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Field added'); setShowFieldForm(false);
    setFieldForm({ label: '', field_type: 'text', is_required: false, is_unique: false, picklist_values: '', lookup_object_id: '', formula: '' });
    loadFields(selected); loadObjects();
  }
  async function archiveField(f: CField) {
    if (!selected) return;
    const res = await fetch(`/api/admin/custom-objects/${selected.id}/fields/${f.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Field archived'); loadFields(selected); loadObjects();
  }
  async function move(f: CField, dir: -1 | 1) {
    if (!selected) return;
    const idx = fields.findIndex(x => x.id === f.id);
    const swap = fields[idx + dir];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/admin/custom-objects/${selected.id}/fields/${f.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_order: swap.display_order }) }),
      fetch(`/api/admin/custom-objects/${selected.id}/fields/${swap.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_order: f.display_order }) }),
    ]);
    loadFields(selected);
  }

  async function openFls(f: CField) {
    if (!selected) return;
    setFlsField(f);
    const res = await fetch(`/api/admin/custom-objects/${selected.id}/fields/${f.id}/permissions`);
    const d = await res.json();
    setFlsRows(d.permissions || []);
  }
  function addFlsRow() {
    if (!flsNew.principal_id.trim()) return;
    setFlsRows(rows => [...rows, { ...flsNew }]);
    setFlsNew({ principal_type: 'role', principal_id: '', can_view: true, can_edit: false });
  }
  async function saveFls() {
    if (!selected || !flsField) return;
    const res = await fetch(`/api/admin/custom-objects/${selected.id}/fields/${flsField.id}/permissions`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: flsRows }),
    });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success(flsRows.length === 0 ? 'Field set to unrestricted' : 'Field security saved'); setFlsField(null);
  }

  return (
    <div className="space-y-4">
      {recordsObject && (
        <div className="space-y-2">
          <button onClick={() => setRecordsObject(null)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
            <Icon name="ArrowLeftIcon" size={13} /> Back to object designer
          </button>
          <DynamicRecordsPanel apiName={recordsObject.api_name} label={recordsObject.label} />
        </div>
      )}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${recordsObject ? 'hidden' : ''}`}>
      {/* Objects */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Custom Objects</h3>
        <div className="flex gap-2 mb-4">
          <input value={objForm.label} onChange={e => setObjForm(f => ({ ...f, label: e.target.value }))} placeholder="Object label (e.g. Project)" className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2" />
          <button onClick={createObject} className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg">Create</button>
        </div>
        {loading ? <p className="text-xs text-slate-400">Loading…</p> : objects.length === 0 ? (
          <p className="text-xs text-slate-400">No custom objects yet. Create one to define a dynamic entity.</p>
        ) : (
          <div className="space-y-2">
            {objects.map(o => (
              <div key={o.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${selected?.id === o.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`} onClick={() => loadFields(o)}>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{o.label}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{o.api_name} · {o.field_count} field{o.field_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); setRecordsObject(o); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Records</button>
                  <button onClick={(e) => { e.stopPropagation(); archiveObject(o); }} className="text-xs text-red-500 hover:text-red-700">Archive</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800">{selected ? `Fields — ${selected.label}` : 'Fields'}</h3>
          {selected && (
            <button onClick={() => setShowFieldForm(v => !v)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">
              <Icon name="PlusIcon" size={12} /> Add Field
            </button>
          )}
        </div>
        {!selected ? <p className="text-xs text-slate-400">Select an object to manage its fields.</p> : (
          <>
            {showFieldForm && (
              <div className="border border-blue-200 rounded-lg p-3 mb-3 space-y-2">
                <div className="flex gap-2">
                  <input value={fieldForm.label} onChange={e => setFieldForm((f: any) => ({ ...f, label: e.target.value }))} placeholder="Field label" className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                  <select value={fieldForm.field_type} onChange={e => setFieldForm((f: any) => ({ ...f, field_type: e.target.value }))} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {PICKLIST_TYPES.includes(fieldForm.field_type) && (
                  <input value={fieldForm.picklist_values} onChange={e => setFieldForm((f: any) => ({ ...f, picklist_values: e.target.value }))} placeholder="Comma-separated values (Open, In Progress, Closed)" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5" />
                )}
                {LOOKUP_TYPES.includes(fieldForm.field_type) && (
                  <select value={fieldForm.lookup_object_id} onChange={e => setFieldForm((f: any) => ({ ...f, lookup_object_id: e.target.value }))} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5">
                    <option value="">Lookup target object…</option>
                    {objects.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                )}
                {fieldForm.field_type === 'formula' && (
                  <input value={fieldForm.formula} onChange={e => setFieldForm((f: any) => ({ ...f, formula: e.target.value }))} placeholder="Formula expression" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono" />
                )}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600"><input type="checkbox" checked={fieldForm.is_required} onChange={e => setFieldForm((f: any) => ({ ...f, is_required: e.target.checked }))} /> Required</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600"><input type="checkbox" checked={fieldForm.is_unique} onChange={e => setFieldForm((f: any) => ({ ...f, is_unique: e.target.checked }))} /> Unique</label>
                  <button onClick={addField} className="ml-auto px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg">Add</button>
                </div>
              </div>
            )}
            {fields.length === 0 ? <p className="text-xs text-slate-400">No fields yet.</p> : (
              <div className="space-y-1.5">
                {fields.map((f, i) => (
                  <div key={f.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700">
                        {f.label}
                        {f.is_required && <span className="text-red-500 ml-1">*</span>}
                        {f.is_unique && <span className="ml-1 text-[9px] bg-violet-100 text-violet-600 px-1 rounded">UQ</span>}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">{f.api_name} · {f.field_type}{f.picklist_values ? ` [${f.picklist_values.join(', ')}]` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(f, -1)} disabled={i === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><Icon name="ChevronUpIcon" size={13} /></button>
                      <button onClick={() => move(f, 1)} disabled={i === fields.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"><Icon name="ChevronDownIcon" size={13} /></button>
                      <button onClick={() => openFls(f)} className="text-xs text-blue-600 hover:text-blue-800 ml-1">Security</button>
                      <button onClick={() => archiveField(f)} className="text-xs text-red-500 hover:text-red-700 ml-1">Archive</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* Field-Level Security modal */}
      <Sheet
        open={!!flsField}
        onClose={() => setFlsField(null)}
        title={flsField ? `Field Security — ${flsField.label}` : 'Field Security'}
        maxWidth="sm:max-w-xl"
        footer={
          <>
            <button onClick={() => setFlsField(null)} className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg">Cancel</button>
            <button onClick={saveFls} className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg">Save</button>
          </>
        }
      >
        <p className="text-[11px] text-slate-400 mb-3">
          No rules = open to anyone with record access. Add rules to restrict this field to specific principals (admins always have full access).
        </p>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-3">
          <select value={flsNew.principal_type} onChange={e => setFlsNew(s => ({ ...s, principal_type: e.target.value }))} className="text-sm border border-slate-200 rounded-lg px-2 py-2">
            {['role', 'user', 'role_group', 'department'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={flsNew.principal_id} onChange={e => setFlsNew(s => ({ ...s, principal_id: e.target.value }))} placeholder={flsNew.principal_type === 'user' ? 'email' : flsNew.principal_type === 'role' ? 'role name' : flsNew.principal_type} className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-3 py-2" />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={flsNew.can_view} onChange={e => setFlsNew(s => ({ ...s, can_view: e.target.checked }))} /> view</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={flsNew.can_edit} onChange={e => setFlsNew(s => ({ ...s, can_edit: e.target.checked }))} /> edit</label>
            <button onClick={addFlsRow} className="ml-auto px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg">Add rule</button>
          </div>
        </div>

        {flsRows.length === 0 ? (
          <p className="text-xs text-slate-400">No rules — field is unrestricted.</p>
        ) : (
          <div className="space-y-1.5">
            {flsRows.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                <span className="text-slate-700 min-w-0 truncate">{r.principal_type}: <b>{r.principal_id}</b> — {r.can_view ? 'view' : ''}{r.can_edit ? '+edit' : ''}{!r.can_view && !r.can_edit ? 'no access' : ''}</span>
                <button onClick={() => setFlsRows(rows => rows.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 flex-shrink-0">Remove</button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
