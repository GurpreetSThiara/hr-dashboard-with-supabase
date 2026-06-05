'use client';

/**
 * Manager approvals queue: submitted timesheets the actor may review. Expand to
 * see entries, then approve / return / reject with an optional comment.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Timesheet, TimeEntry } from '@/lib/timeTracking';
import { formatMinutes } from '@/lib/timeTracking';
import EntriesList from './EntriesList';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/AppIcon';

type Row = Timesheet & { first_name?: string; last_name?: string };

export default function ApprovalsTab({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/time/timesheets?scope=approvals&status=submitted').then((res) => res.json());
      setRows(r.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setComment('');
    const detail = await fetch(`/api/time/timesheets/${id}`).then((r) => r.json());
    setEntries(detail.entries || []);
  }

  async function decide(id: string, action: 'approve' | 'reject' | 'return') {
    setBusy(true);
    try {
      const res = await fetch(`/api/time/timesheets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Action failed');
      toast.success(`Timesheet ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'returned'}`);
      setExpanded(null);
      await load();
      onChange?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}</div>;
  }
  if (rows.length === 0) {
    return <EmptyState icon="CheckBadgeIcon" title="Nothing to approve" description="Submitted timesheets from your team will appear here." />;
  }

  return (
    <div className="space-y-3">
      {rows.map((ts) => {
        const name = ts.first_name ? `${ts.first_name} ${ts.last_name ?? ''}`.trim() : ts.employee_email;
        const open = expanded === ts.id;
        return (
          <div key={ts.id} className="rounded-xl border border-slate-200 bg-white">
            <button onClick={() => toggle(ts.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <Icon name={open ? 'ChevronDownIcon' : 'ChevronRightIcon'} size={16} className="text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                <p className="text-xs text-slate-500">
                  Week of {new Date(ts.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <span className="text-xs text-slate-500">{formatMinutes(ts.billable_minutes)} billable</span>
              <span className="font-mono text-sm tabular-nums text-slate-700">{formatMinutes(ts.total_minutes)}</span>
            </button>
            {open && (
              <div className="border-t border-slate-100 p-4 space-y-3">
                <EntriesList entries={entries} editable={false} />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment (required when returning or rejecting)…"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={() => decide(ts.id, 'return')} disabled={busy} className="btn-secondary">Return for changes</button>
                  <button onClick={() => decide(ts.id, 'reject')} disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50">
                    Reject
                  </button>
                  <button onClick={() => decide(ts.id, 'approve')} disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                    <Icon name="CheckIcon" size={16} /> Approve
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
