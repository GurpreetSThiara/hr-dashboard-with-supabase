'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { api, downloadCsv } from '@/lib/api';
import { Card, Button, Badge, PageHeader, Loading, ErrorBanner, EmptyState, inputClass } from '@/components/ui';

interface AuditRow {
  id: string; actor_email: string | null; action: string;
  target_type: string | null; target_id: string | null; detail: any; created_at: string;
}

const ACTION_TONE: Record<string, string> = {
  create: 'active', update: 'brand', delete: 'suspended', toggle: 'neutral',
  subscription: 'brand', module_override: 'brand',
};
function tone(action: string) {
  const key = action.split('.').pop() || '';
  return ACTION_TONE[key] ?? 'neutral';
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api<{ data: AuditRow[] }>('/api/audit').then(d => setRows(d.data)).catch(e => { setError(e.message); setRows([]); });
  }, []);

  const actions = useMemo(() => Array.from(new Set((rows ?? []).map(r => r.action))).sort(), [rows]);
  const filtered = useMemo(() => (rows ?? []).filter(r => filter === 'all' || r.action === filter), [rows, filter]);

  return (
    <Shell>
      <PageHeader title="Audit Log" subtitle="Every platform-level change, newest first."
        actions={<>
          <select value={filter} onChange={e => setFilter(e.target.value)} className={`${inputClass} max-w-[200px]`}>
            <option value="all">All actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <Button variant="secondary" disabled={!filtered.length}
            onClick={() => downloadCsv('audit-log.csv', filtered.map(r => ({
              created_at: r.created_at, actor: r.actor_email ?? '', action: r.action,
              target_type: r.target_type ?? '', target_id: r.target_id ?? '', detail: r.detail ?? '',
            })))}>Export CSV</Button>
        </>} />
      <ErrorBanner message={error} />

      {rows === null ? <Loading /> : filtered.length === 0 ? (
        <Card><EmptyState title="No activity yet" hint="Actions like creating orgs or changing plans appear here." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">When</th>
                <th className="px-6 py-3 font-medium">Actor</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Target</th>
                <th className="px-6 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-6 py-3 text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-6 py-3 text-slate-700">{r.actor_email ?? 'system'}</td>
                  <td className="px-6 py-3"><Badge tone={tone(r.action)}>{r.action}</Badge></td>
                  <td className="px-6 py-3 text-slate-500">{r.target_type}{r.target_id ? <span className="block text-xs text-slate-400">{r.target_id.slice(0, 8)}</span> : null}</td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-400">{r.detail ? JSON.stringify(r.detail) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Shell>
  );
}
