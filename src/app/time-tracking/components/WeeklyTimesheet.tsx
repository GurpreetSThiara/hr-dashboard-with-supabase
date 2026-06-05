'use client';

/**
 * Weekly timesheet: totals (worked / billable / non-billable / overtime), the
 * week's entries, and the submit-for-approval action. Navigable across weeks.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Timesheet, TimeEntry } from '@/lib/timeTracking';
import {
  startOfWeek, endOfWeek, toDateStr, formatMinutes, WEEKLY_OVERTIME_THRESHOLD_MIN,
} from '@/lib/timeTracking';
import EntriesList from './EntriesList';
import ManualEntryModal from './ManualEntryModal';
import Icon from '@/components/ui/AppIcon';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  returned: 'bg-orange-50 text-orange-700',
};

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

export default function WeeklyTimesheet({ refreshKey, onChange }: { refreshKey?: number; onChange?: () => void }) {
  const [anchor, setAnchor] = useState(new Date());
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Partial<TimeEntry> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure the week's timesheet exists, then load its detail + entries.
      const ensure = await fetch('/api/time/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_start: toDateStr(startOfWeek(anchor)) }),
      }).then((r) => r.json());
      const id = ensure.data?.id;
      if (!id) { setTimesheet(null); setEntries([]); return; }
      const detail = await fetch(`/api/time/timesheets/${id}`).then((r) => r.json());
      setTimesheet(detail.timesheet || null);
      setEntries(detail.entries || []);
    } finally {
      setLoading(false);
    }
  }, [anchor]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function action(act: 'submit') {
    if (!timesheet) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/time/timesheets/${timesheet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Action failed');
      toast.success('Timesheet submitted for approval');
      await load();
      onChange?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const total = timesheet?.total_minutes ?? 0;
  const billable = timesheet?.billable_minutes ?? 0;
  const overtime = Math.max(0, total - WEEKLY_OVERTIME_THRESHOLD_MIN);
  const status = timesheet?.status ?? 'draft';
  const canSubmit = ['draft', 'returned', 'rejected'].includes(status) && total > 0;

  const weekLabel = `${startOfWeek(anchor).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${endOfWeek(anchor).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  function shiftWeek(delta: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    setAnchor(d);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} aria-label="Previous week" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <Icon name="ChevronLeftIcon" size={16} />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[180px] text-center">{weekLabel}</span>
          <button onClick={() => shiftWeek(1)} aria-label="Next week" className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <Icon name="ChevronRightIcon" size={16} />
          </button>
          <span className={`ml-2 text-xs px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[status]}`}>{status}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-secondary">
            <Icon name="PlusIcon" size={16} /> Add entry
          </button>
          <button onClick={() => action('submit')} disabled={!canSubmit || busy} className="btn-primary">
            <Icon name="PaperAirplaneIcon" size={16} /> Submit
          </button>
        </div>
      </div>

      {timesheet?.reviewer_comment && status !== 'approved' && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <span className="font-medium">Reviewer note:</span> {timesheet.reviewer_comment}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total worked" value={formatMinutes(total)} />
        <StatCard label="Billable" value={formatMinutes(billable)} accent="text-emerald-600" />
        <StatCard label="Non-billable" value={formatMinutes(total - billable)} accent="text-slate-600" />
        <StatCard label="Overtime" value={formatMinutes(overtime)} accent={overtime > 0 ? 'text-rose-600' : 'text-slate-800'} />
      </div>

      <EntriesList
        entries={entries}
        loading={loading}
        editable={status === 'draft' || status === 'returned' || status === 'rejected'}
        onEdit={(e) => { setEditing(e); setModalOpen(true); }}
        onDuplicate={(e) => { setEditing({ ...e, id: undefined }); setModalOpen(true); }}
        onChanged={() => { load(); onChange?.(); }}
        emptyTitle="No entries this week"
        emptyDescription="Add an entry or run the timer to fill your timesheet."
      />

      <ManualEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { load(); onChange?.(); }}
        entry={editing}
      />
    </div>
  );
}
