'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

interface AuditRow {
  id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  'permission_matrix.update': 'bg-purple-100 text-purple-700',
  'user.role_change': 'bg-blue-100 text-blue-700',
  'user.deactivate': 'bg-red-100 text-red-600',
  'leave_visibility_config.update': 'bg-cyan-100 text-cyan-700',
  'leave_approval_config.update': 'bg-emerald-100 text-emerald-700',
};

export default function AdminAuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterEmail, setFilterEmail] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const LIMIT = 40;

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filterEmail) p.set('actor_email', filterEmail);
    if (filterAction) p.set('action', filterAction);
    fetch(`/api/admin/audit?${p}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Forbidden or failed'))))
      .then((d) => {
        setRows(d.data || []);
        setActions(d.actions || []);
        setTotal(d.pagination?.total || 0);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, filterEmail, filterAction]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-1">Administrative Audit Log</h3>
        <p className="text-xs text-slate-500 mb-3">Every privileged configuration change — who, when, what changed, and from where.</p>
        <div className="flex gap-2 flex-wrap">
          <input
            value={filterEmail}
            onChange={(e) => { setFilterEmail(e.target.value); setPage(1); }}
            placeholder="Filter by actor email…"
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={load} className="p-2 text-slate-400 hover:text-slate-700">
            <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">No audit entries</div>
      ) : (
      <>
        {/* Desktop table */}
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['When', 'Actor', 'Action', 'Summary', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">{r.actor_email || '—'}</p>
                    {r.actor_role && <p className="text-[11px] text-slate-400">{r.actor_role}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${ACTION_COLORS[r.action] || 'bg-slate-100 text-slate-600'}`}>
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[280px] truncate" title={r.summary || ''}>
                    {r.summary || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(r.old_value || r.new_value) && (
                      <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-xs text-blue-600 font-medium">
                        {expanded === r.id ? 'Hide' : 'Diff'}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <p className="font-bold text-slate-400 uppercase mb-1">Before</p>
                          <pre className="bg-white border border-slate-200 rounded p-2 overflow-x-auto text-slate-600">{r.old_value ? JSON.stringify(r.old_value, null, 2) : '—'}</pre>
                        </div>
                        <div>
                          <p className="font-bold text-slate-400 uppercase mb-1">After</p>
                          <pre className="bg-white border border-slate-200 rounded p-2 overflow-x-auto text-slate-600">{r.new_value ? JSON.stringify(r.new_value, null, 2) : '—'}</pre>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">
                        {r.entity_type ? `Entity: ${r.entity_type}${r.entity_id ? ` (${r.entity_id})` : ''} · ` : ''}
                        IP: {r.ip_address || 'n/a'}
                      </p>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="md:hidden p-3 space-y-2.5">
          {rows.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${ACTION_COLORS[r.action] || 'bg-slate-100 text-slate-600'}`}>
                  {r.action}
                </span>
                <span className="text-[11px] text-slate-400 flex-shrink-0">{new Date(r.created_at).toLocaleString('en-GB')}</span>
              </div>
              {r.summary && <p className="text-xs text-slate-700 mb-1.5">{r.summary}</p>}
              <p className="text-[11px] text-slate-500">
                by <span className="font-medium text-slate-700">{r.actor_email || '—'}</span>
                {r.actor_role ? <span className="text-slate-400"> · {r.actor_role}</span> : null}
              </p>
              {(r.old_value || r.new_value) && (
                <>
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="mt-2 text-xs text-blue-600 font-medium"
                  >
                    {expanded === r.id ? 'Hide changes' : 'View changes'}
                  </button>
                  {expanded === r.id && (
                    <div className="mt-2 space-y-2 text-[11px]">
                      <div>
                        <p className="font-bold text-slate-400 uppercase mb-1">Before</p>
                        <pre className="bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto text-slate-600">{r.old_value ? JSON.stringify(r.old_value, null, 2) : '—'}</pre>
                      </div>
                      <div>
                        <p className="font-bold text-slate-400 uppercase mb-1">After</p>
                        <pre className="bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto text-slate-600">{r.new_value ? JSON.stringify(r.new_value, null, 2) : '—'}</pre>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {r.entity_type ? `Entity: ${r.entity_type}${r.entity_id ? ` (${r.entity_id})` : ''} · ` : ''}IP: {r.ip_address || 'n/a'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </>
      )}

      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{total} entries</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40">‹</button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
