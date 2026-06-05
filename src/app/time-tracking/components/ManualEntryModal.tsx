'use client';

/**
 * Add or edit a manual time entry. Accepts either a start+end time or an
 * explicit duration. Used for historical logging, editing, and duplication
 * (pass an `initial` without an id to prefill a new entry).
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { TimeEntry } from '@/lib/timeTracking';
import { toDateStr } from '@/lib/timeTracking';
import { useLookups } from './useLookups';
import Icon from '@/components/ui/AppIcon';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  entry?: Partial<TimeEntry> | null; // with id => edit; without id => prefilled create
}

function timeStr(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ManualEntryModal({ open, onClose, onSaved, entry }: Props) {
  const { projects, tasksByProject, loadTasks } = useLookups();
  const isEdit = !!entry?.id;

  const [date, setDate] = useState(toDateStr(new Date()));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = entry?.started_at ? new Date(entry.started_at) : new Date();
    setDate(toDateStr(start));
    setStartTime(timeStr(entry?.started_at) || '09:00');
    setEndTime(timeStr(entry?.ended_at) || '10:00');
    setProjectId(entry?.project_id || '');
    setTaskId(entry?.task_id || '');
    setDescription(entry?.description || '');
    setBillable(entry?.is_billable !== false);
  }, [open, entry]);

  useEffect(() => { if (projectId) loadTasks(projectId); }, [projectId, loadTasks]);
  const tasks = projectId ? tasksByProject[projectId] || [] : [];

  if (!open) return null;

  async function handleSave() {
    const startedAt = new Date(`${date}T${startTime}:00`);
    const endedAt = new Date(`${date}T${endTime}:00`);
    if (endedAt <= startedAt) {
      toast.error('End time must be after start time');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        project_id: projectId || null,
        task_id: taskId || null,
        description: description.trim() || null,
        is_billable: billable,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
      };
      const res = await fetch(
        isEdit ? `/api/time/entries/${entry!.id}` : '/api/time/entries',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not save entry');
      toast.success(isEdit ? 'Entry updated' : 'Entry added');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{isEdit ? 'Edit time entry' : 'Add time entry'}</h3>
          <button onClick={onClose} aria-label="Close"><Icon name="XMarkIcon" size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="What did you work on?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
              <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(''); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500">
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Task</label>
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={!projectId}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-50 focus:ring-2 focus:ring-blue-500">
                <option value="">No task</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="rounded border-slate-300" />
            Billable
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
