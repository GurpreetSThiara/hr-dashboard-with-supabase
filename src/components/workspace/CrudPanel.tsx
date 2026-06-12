'use client';

/**
 * Generic tenant CRUD panel. Lists rows from /api/workspace/[entity] with an
 * add/EDIT form, search, column sort, CSV export, row count, per-row delete and
 * optional boolean toggles. Field/display config is passed by the Workspace
 * page; the server enforces the real column/tenant allowlist.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'select' | 'csv';
export interface FieldDef { name: string; label: string; type?: FieldType; options?: string[]; required?: boolean; }
export interface DisplayCol { name: string; label: string; kind?: 'text' | 'date' | 'bool' | 'badge'; }

export default function CrudPanel({
  entity, title, description, fields, display, toggleField,
}: {
  entity: string; title: string; description?: string;
  fields: FieldDef[]; display: DisplayCol[]; toggleField?: string;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const blank = () => Object.fromEntries(fields.map(f => [f.name, f.type === 'checkbox' ? false : '']));
  const [form, setForm] = useState<Record<string, any>>(blank());

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${entity}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setRows(d.data);
    } catch (e: any) { setError(e.message); setRows([]); }
  }, [entity]);
  useEffect(() => { load(); setEditingId(null); setForm(blank()); setQ(''); setSort(null); /* eslint-disable-next-line */ }, [entity]);

  function buildPayload() {
    const payload: Record<string, any> = {};
    for (const f of fields) {
      let v = form[f.name];
      if (f.type === 'checkbox') { payload[f.name] = !!v; continue; }
      if (v === '' || v === undefined) continue;
      if (f.type === 'number') v = Number(v);
      if (f.type === 'csv') v = String(v).split(',').map(s => s.trim()).filter(Boolean);
      payload[f.name] = v;
    }
    return payload;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const url = editingId ? `/api/workspace/${entity}/${editingId}` : `/api/workspace/${entity}`;
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setForm(blank()); setEditingId(null); await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  function startEdit(r: any) {
    setEditingId(r.id);
    setForm(Object.fromEntries(fields.map(f => {
      let v = r[f.name];
      if (f.type === 'date' && v) v = String(v).slice(0, 10);
      if (f.type === 'csv' && Array.isArray(v)) v = v.join(', ');
      return [f.name, v ?? (f.type === 'checkbox' ? false : '')];
    })));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function patch(id: string, body: any) {
    try { await fetch(`/api/workspace/${entity}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await load(); }
    catch (e: any) { setError(e.message); }
  }
  async function remove(id: string) {
    if (!confirm('Delete this item?')) return;
    try { await fetch(`/api/workspace/${entity}/${id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { setError(e.message); }
  }

  const fmt = (v: any, kind?: string) => {
    if (v == null || v === '') return '—';
    if (kind === 'date') return new Date(v).toLocaleDateString();
    if (kind === 'bool') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  };

  const filtered = useMemo(() => {
    let r = rows ?? [];
    if (q) {
      const needle = q.toLowerCase();
      r = r.filter(row => display.some(c => String(row[c.name] ?? '').toLowerCase().includes(needle)));
    }
    if (sort) {
      r = [...r].sort((a, b) => {
        const av = a[sort.col], bv = b[sort.col];
        if (av == null) return 1; if (bv == null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
      });
    }
    return r;
  }, [rows, q, sort, display]);

  function exportCsv() {
    if (!filtered.length) return;
    const cols = display.map(c => c.name);
    const esc = (v: any) => { const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [display.map(c => c.label).join(','), ...filtered.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `${entity}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title} {rows && <span className="text-sm font-normal text-slate-400">({rows.length})</span>}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button onClick={exportCsv} disabled={!filtered.length} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Export CSV</button>
        </div>
      </div>
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        {editingId && <div className="col-span-full text-xs font-medium text-brand-600">Editing existing item — <button type="button" className="underline" onClick={() => { setEditingId(null); setForm(blank()); }}>cancel</button></div>}
        {fields.map(f => (
          <label key={f.name} className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{f.label}</span>
            {f.type === 'textarea' ? (
              <textarea value={form[f.name] ?? ''} onChange={e => setForm(s => ({ ...s, [f.name]: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} />
            ) : f.type === 'checkbox' ? (
              <input type="checkbox" checked={!!form[f.name]} onChange={e => setForm(s => ({ ...s, [f.name]: e.target.checked }))} className="h-5 w-5" />
            ) : f.type === 'select' ? (
              <select value={form[f.name] ?? ''} onChange={e => setForm(s => ({ ...s, [f.name]: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">—</option>{f.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                value={form[f.name] ?? ''} onChange={e => setForm(s => ({ ...s, [f.name]: e.target.value }))}
                placeholder={f.type === 'csv' ? 'comma,separated' : ''} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            )}
          </label>
        ))}
        <div className="flex items-end">
          <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add'}
          </button>
        </div>
      </form>

      {rows === null ? (
        <p className="py-8 text-center text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-slate-400">{q ? 'No matches.' : 'Nothing here yet.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {display.map(c => (
                  <th key={c.name} className="cursor-pointer select-none px-4 py-3 font-medium hover:text-slate-600"
                    onClick={() => setSort(s => s?.col === c.name ? { col: c.name, dir: (s.dir === 1 ? -1 : 1) } : { col: c.name, dir: 1 })}>
                    {c.label}{sort?.col === c.name ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  {display.map(c => (
                    <td key={c.name} className="px-4 py-2 text-slate-700">
                      {c.kind === 'badge' ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{fmt(r[c.name])}</span> : fmt(r[c.name], c.kind)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {toggleField && (
                        <button onClick={() => patch(r.id, { [toggleField]: !r[toggleField] })} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                          {r[toggleField] ? 'Undo' : 'Done'}
                        </button>
                      )}
                      <button onClick={() => startEdit(r)} className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">Edit</button>
                      <button onClick={() => remove(r.id)} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
