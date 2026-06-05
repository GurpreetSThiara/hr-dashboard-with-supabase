'use client';

import { toast } from 'sonner';
import type { TimeEntry } from '@/lib/timeTracking';
import { formatMinutes } from '@/lib/timeTracking';
import Icon from '@/components/ui/AppIcon';
import EmptyState from '@/components/ui/EmptyState';

interface Props {
  entries: TimeEntry[];
  loading?: boolean;
  editable?: boolean;
  onEdit?: (e: TimeEntry) => void;
  onDuplicate?: (e: TimeEntry) => void;
  onChanged?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export default function EntriesList({
  entries, loading, editable = true, onEdit, onDuplicate, onChanged,
  emptyTitle = 'No time logged', emptyDescription = 'Start the timer or add an entry to see it here.',
}: Props) {
  async function handleDelete(e: TimeEntry) {
    if (!confirm('Delete this time entry?')) return;
    try {
      const res = await fetch(`/api/time/entries/${e.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not delete');
      toast.success('Entry deleted');
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState icon="ClockIcon" title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">
              {e.description || e.task_name || e.project_name || 'Untitled'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {e.project_name || 'No project'}
              {e.task_name ? ` · ${e.task_name}` : ''}
              {e.client_name ? ` · ${e.client_name}` : ''}
            </p>
          </div>
          <span className={`hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full ${e.is_billable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {e.is_billable ? 'Billable' : 'Non-billable'}
          </span>
          <span className="font-mono text-sm tabular-nums text-slate-700 w-16 text-right">{formatMinutes(e.duration_minutes)}</span>
          {editable && (
            <div className="flex items-center gap-1">
              {onDuplicate && (
                <button onClick={() => onDuplicate(e)} aria-label="Duplicate" className="p-1.5 rounded hover:bg-slate-100">
                  <Icon name="DocumentDuplicateIcon" size={16} className="text-slate-400" />
                </button>
              )}
              {onEdit && (
                <button onClick={() => onEdit(e)} aria-label="Edit" className="p-1.5 rounded hover:bg-slate-100">
                  <Icon name="PencilSquareIcon" size={16} className="text-slate-400" />
                </button>
              )}
              <button onClick={() => handleDelete(e)} aria-label="Delete" className="p-1.5 rounded hover:bg-slate-100">
                <Icon name="TrashIcon" size={16} className="text-slate-400" />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
